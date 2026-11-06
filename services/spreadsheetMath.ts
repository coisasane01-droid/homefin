import type {
  HomeFinSpreadsheet,
  SpreadsheetColumn,
  SpreadsheetRow,
} from '../types/spreadsheets';

export const parseSpreadsheetCurrency = (value: string): number | null => {
  const cleaned = value.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!cleaned) return 0;
  const brazilianFormat = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const decimalFormat = /^-?\d+\.\d{1,2}$/;
  if (!brazilianFormat.test(cleaned) && !decimalFormat.test(cleaned)) return null;
  const normalized = brazilianFormat.test(cleaned)
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

export const calculateSpreadsheetRowTotal = (
  row: SpreadsheetRow,
  columns: SpreadsheetColumn[]
): number | null => {
  let total = 0;
  for (const column of columns) {
    if (column.type !== 'currency') continue;
    const amount = parseSpreadsheetCurrency(row.cells[column.id] || '');
    if (amount === null) return null;
    total += amount;
  }
  return total;
};

export const calculateSpreadsheetTotal = (
  spreadsheet: HomeFinSpreadsheet
): number | null => {
  let total = 0;
  for (const row of spreadsheet.rows) {
    const rowTotal = calculateSpreadsheetRowTotal(row, spreadsheet.columns);
    if (rowTotal === null) return null;
    total += rowTotal;
  }
  return total;
};

export const calculateSpreadsheetCommissionBase = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'rows'>,
  columnId: string | null | undefined
): number => {
  if (!columnId) return 0;
  return spreadsheet.rows.reduce((total, row) => {
    const value = row.cells[columnId]?.trim() || '';
    if (!value) return total;
    const amount = parseSpreadsheetCurrency(value);
    return amount === null ? total : total + amount;
  }, 0);
};

export const parseSpreadsheetCommissionPercentage = (value: string): number | null => {
  const cleaned = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const percentage = Number(cleaned);
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
    ? percentage
    : null;
};

export const calculateSpreadsheetCommission = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'rows' | 'commissionColumnId' | 'commissionPercentage'>
): number => {
  const commission = calculateSpreadsheetCommissionBase(
    spreadsheet,
    spreadsheet.commissionColumnId
  ) * (Number(spreadsheet.commissionPercentage) || 0) / 100;
  return Math.round((commission + Number.EPSILON) * 100) / 100;
};

export const hasInvalidSpreadsheetCurrency = (
  spreadsheet: HomeFinSpreadsheet
): boolean => spreadsheet.rows.some((row) =>
  spreadsheet.columns.some((column) =>
    column.type === 'currency' &&
    parseSpreadsheetCurrency(row.cells[column.id] || '') === null
  )
);
