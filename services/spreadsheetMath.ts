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

export const hasInvalidSpreadsheetCurrency = (
  spreadsheet: HomeFinSpreadsheet
): boolean => spreadsheet.rows.some((row) =>
  spreadsheet.columns.some((column) =>
    column.type === 'currency' &&
    parseSpreadsheetCurrency(row.cells[column.id] || '') === null
  )
);
