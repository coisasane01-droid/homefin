import type {
  HomeFinSpreadsheet,
  SpreadsheetColumn,
  SpreadsheetRow,
} from '../types/spreadsheets';

export const SPREADSHEET_TOTAL_COMMISSION_BASE = '__total_general__';

const toSpreadsheetNumericString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';

  const withParentheses = text.startsWith('(') && text.endsWith(')')
    ? `-${text.slice(1, -1)}`
    : text;

  const cleaned = withParentheses
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\s/g, '');

  if (!cleaned) return '';
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    return lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  }
  if (cleaned.includes(',')) {
    return cleaned.replace(',', '.');
  }
  return cleaned;
};

export const parseSpreadsheetCurrency = (value: string | number | null | undefined): number | null => {
  const cleaned = toSpreadsheetNumericString(value);
  if (!cleaned) return 0;

  const brazilianFormat = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const decimalFormat = /^-?\d+(?:\.\d{1,2})?$/;
  if (!brazilianFormat.test(cleaned) && !decimalFormat.test(cleaned)) return null;

  const normalized = brazilianFormat.test(cleaned)
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const applyStructuredSpreadsheetFormula = (
  first: number,
  operator: '+' | '-' | '*' | '/',
  second: number
): number | null => {
  let result: number;
  if (operator === '+') result = first + second;
  else if (operator === '-') result = first - second;
  else if (operator === '*') result = first * second;
  else {
    if (second === 0) return null;
    result = first / second;
  }
  return Number.isFinite(result) ? result : null;
};

const getRawSpreadsheetColumnTotal = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows'>,
  columnId: string
): number => spreadsheet.rows.reduce((total, row) => {
  const amount = parseSpreadsheetCurrency(row.cells[columnId] || '');
  return amount === null ? total : total + amount;
}, 0);

export const calculateSpreadsheetColumnTotal = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows'>,
  columnId: string | null | undefined
): number => {
  if (!columnId) return 0;

  const column = spreadsheet.columns.find((item) => item.id === columnId);
  if (!column || column.type !== 'currency') return 0;

  const config = column.formulaConfig;
  if (config) {
    const firstColumn = spreadsheet.columns.find((item) => item.id === config.sourceColumnId);
    const secondColumn = spreadsheet.columns.find((item) => item.id === config.secondColumnId);
    if (!firstColumn || !secondColumn) return 0;

    if (config.mode === 'column') {
      const first = getRawSpreadsheetColumnTotal(spreadsheet, firstColumn.id);
      const second = getRawSpreadsheetColumnTotal(spreadsheet, secondColumn.id);
      return applyStructuredSpreadsheetFormula(first, config.operator, second) ?? 0;
    }

    return spreadsheet.rows.reduce((total, row) => {
      const value = calculateSpreadsheetColumnFormula(spreadsheet, column.id, row);
      return total + (value ?? 0);
    }, 0);
  }

  const formula = column.formulaExpression || column.formula;
  if (formula) {
    return spreadsheet.rows.reduce((total, row) => {
      const value = calculateSpreadsheetColumnFormula(spreadsheet, column.id, row);
      return total + (value ?? 0);
    }, 0);
  }

  return getRawSpreadsheetColumnTotal(spreadsheet, column.id);
};

export const calculateSpreadsheetColumnTotals = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows'>
): Record<string, number> => {
  return Object.fromEntries(
    spreadsheet.columns
      .filter((column) => column.type === 'currency')
      .map((column) => [column.id, calculateSpreadsheetColumnTotal(spreadsheet, column.id)])
  );
};

export const calculateSpreadsheetRowTotal = (
  row: SpreadsheetRow,
  columns: SpreadsheetColumn[]
): number | null => {
  let total = 0;
  for (const column of columns) {
    if (column.type !== 'currency') continue;

    if (column.formulaConfig?.mode === 'column') continue;

    if (column.formulaConfig || column.formulaExpression || column.formula) {
      const value = calculateSpreadsheetColumnFormula(
        { columns, rows: [row] },
        column.id,
        row
      );
      if (value === null) return null;
      total += value;
      continue;
    }

    const amount = parseSpreadsheetCurrency(row.cells[column.id] || '');
    if (amount === null) return null;
    total += amount;
  }
  return total;
};

export const calculateSpreadsheetTotal = (
  spreadsheet: HomeFinSpreadsheet
): number | null => {
  if (hasInvalidSpreadsheetCurrency(spreadsheet)) return null;
  return spreadsheet.columns
    .filter((column) => column.type === 'currency')
    .reduce((total, column) => total + calculateSpreadsheetColumnTotal(spreadsheet, column.id), 0);
};

export const calculateSpreadsheetCommissionBase = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows'>,
  columnId: string | null | undefined
): number => {
  if (!columnId) return 0;
  if (columnId === SPREADSHEET_TOTAL_COMMISSION_BASE) {
    return spreadsheet.columns
      .filter((column) => column.type === 'currency')
      .reduce((total, column) => total + calculateSpreadsheetColumnTotal(spreadsheet, column.id), 0);
  }

  return calculateSpreadsheetColumnTotal(spreadsheet, columnId);
};

export const parseSpreadsheetCommissionPercentage = (value: string): number | null => {
  const cleaned = String(value ?? '').trim().replace(/%/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const percentage = Number(cleaned);
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
    ? percentage
    : null;
};

export const calculateSpreadsheetCommission = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows' | 'commissionColumnId' | 'commissionPercentage'>
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
    !column.formulaConfig &&
    !column.formulaExpression &&
    !column.formula &&
    parseSpreadsheetCurrency(row.cells[column.id] || '') === null
  )
);

const normalizeSpreadsheetFormulaReference = (value: string): string =>
  value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

const tokenizeSpreadsheetFormula = (expression: string): string[] => {
  const sanitized = String(expression ?? '').trim();
  if (!sanitized) return [];

  const tokens: string[] = [];
  let current = '';

  for (let index = 0; index < sanitized.length; index += 1) {
    const char = sanitized[index];
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    if ('()+-*/'.includes(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
      continue;
    }
    if (char === ',') {
      const previous = current[current.length - 1];
      const next = sanitized[index + 1] ?? '';
      if (previous && /\d/.test(previous) && /\d/.test(next)) {
        current += char;
        continue;
      }
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
};

const resolveSpreadsheetFormulaReference = (
  expression: string,
  columns: SpreadsheetColumn[]
): Map<string, string> => {
  const references = new Map<string, string>();
  for (const column of columns) {
    references.set(normalizeSpreadsheetFormulaReference(column.id), column.id);
    references.set(normalizeSpreadsheetFormulaReference(column.name), column.id);
  }
  return references;
};

const spreadsheetFormulaParser = (
  expression: string,
  columns: SpreadsheetColumn[]
): { value: number | null; references: Set<string> } | null => {
  const tokens = tokenizeSpreadsheetFormula(expression);
  if (!tokens.length) {
    return { value: null, references: new Set() };
  }

  const references = resolveSpreadsheetFormulaReference(expression, columns);
  let index = 0;

  const parsePrimary = (): number | null => {
    if (index >= tokens.length) return null;
    const token = tokens[index];
    if (token === '(') {
      index += 1;
      const value = parseAdditive();
      if (tokens[index] !== ')') return null;
      index += 1;
      return value;
    }
    if (/^[-+]?\d+(?:[.,]\d+)?$/.test(token)) {
      index += 1;
      return Number(token.replace(',', '.'));
    }
    if (/^[A-Za-z0-9_]+$/.test(token)) {
      const normalized = normalizeSpreadsheetFormulaReference(token);
      const mapped = references.get(normalized);
      index += 1;
      return mapped ? Number.NaN : null;
    }
    return null;
  };

  const parseUnary = (): number | null => {
    if (index >= tokens.length) return null;
    if (tokens[index] === '+') {
      index += 1;
      return parseUnary();
    }
    if (tokens[index] === '-') {
      index += 1;
      const value = parseUnary();
      return value === null ? null : -value;
    }
    return parsePrimary();
  };

  const parseMultiplicative = (): number | null => {
    let value = parseUnary();
    while (index < tokens.length && (tokens[index] === '*' || tokens[index] === '/')) {
      const operator = tokens[index];
      index += 1;
      const rhs = parseUnary();
      if (value === null || rhs === null) return null;
      if (operator === '*') value = value * rhs;
      else if (rhs === 0) return null;
      else value = value / rhs;
    }
    return value;
  };

  const parseAdditive = (): number | null => {
    let value = parseMultiplicative();
    while (index < tokens.length && (tokens[index] === '+' || tokens[index] === '-')) {
      const operator = tokens[index];
      index += 1;
      const rhs = parseMultiplicative();
      if (value === null || rhs === null) return null;
      value = operator === '+' ? value + rhs : value - rhs;
    }
    return value;
  };

  const parsed = parseAdditive();
  if (parsed === null || index !== tokens.length) return null;
  return { value: parsed, references: new Set() };
};

export const evaluateSpreadsheetFormula = (
  expression: string | null | undefined,
  row: SpreadsheetRow,
  columns: SpreadsheetColumn[]
): number | null => {
  if (!expression || !expression.trim()) return null;

  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(normalizeSpreadsheetFormulaReference(column.id), column.id);
    lookup.set(normalizeSpreadsheetFormulaReference(column.name), column.id);
  }

  const tokens = tokenizeSpreadsheetFormula(expression);
  if (!tokens.length) return null;

  let index = 0;
  const parsePrimary = (): number | null => {
    if (index >= tokens.length) return null;
    const token = tokens[index];
    if (token === '(') {
      index += 1;
      const value = parseAdditive();
      if (value === null || tokens[index] !== ')') return null;
      index += 1;
      return value;
    }
    if (/^[-+]?\d+(?:[.,]\d+)?$/.test(token)) {
      index += 1;
      return Number(token.replace(',', '.'));
    }
    if (/^[A-Za-z0-9_]+$/.test(token)) {
      const normalized = normalizeSpreadsheetFormulaReference(token);
      const columnId = lookup.get(normalized);
      if (!columnId) return null;
      index += 1;
      const raw = row.cells[columnId];
      const amount = parseSpreadsheetCurrency(raw ?? '');
      return amount === null ? null : amount;
    }
    return null;
  };

  const parseUnary = (): number | null => {
    if (index >= tokens.length) return null;
    if (tokens[index] === '+') {
      index += 1;
      return parseUnary();
    }
    if (tokens[index] === '-') {
      index += 1;
      const value = parseUnary();
      return value === null ? null : -value;
    }
    return parsePrimary();
  };

  const parseMultiplicative = (): number | null => {
    let value = parseUnary();
    while (index < tokens.length && (tokens[index] === '*' || tokens[index] === '/')) {
      const operator = tokens[index];
      index += 1;
      const rhs = parseUnary();
      if (value === null || rhs === null) return null;
      if (operator === '*') value = value * rhs;
      else if (rhs === 0) return null;
      else value = value / rhs;
    }
    return value;
  };

  const parseAdditive = (): number | null => {
    let value = parseMultiplicative();
    while (index < tokens.length && (tokens[index] === '+' || tokens[index] === '-')) {
      const operator = tokens[index];
      index += 1;
      const rhs = parseMultiplicative();
      if (value === null || rhs === null) return null;
      value = operator === '+' ? value + rhs : value - rhs;
    }
    return value;
  };

  const parsed = parseAdditive();
  if (parsed === null || index !== tokens.length) return null;
  return Number.isFinite(parsed) ? parsed : null;
};

export const calculateSpreadsheetColumnFormula = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows'>,
  columnId: string,
  row?: SpreadsheetRow | null
): number | null => {
  const column = spreadsheet.columns.find((item) => item.id === columnId)
    || spreadsheet.columns.find((item) => item.name === columnId);
  if (!column) return null;

  const targetRow = row ?? spreadsheet.rows[0];
  const config = column.formulaConfig;

  if (config) {
    if (config.mode === 'column' || !targetRow) return null;

    const firstRaw = targetRow.cells[config.sourceColumnId] || '';
    const secondRaw = targetRow.cells[config.secondColumnId] || '';
    const first = parseSpreadsheetCurrency(firstRaw);
    const second = parseSpreadsheetCurrency(secondRaw);

    if (first === null || second === null) return null;
    return applyStructuredSpreadsheetFormula(first, config.operator, second);
  }

  if (!targetRow) return null;
  const formula = column.formula || column.formulaExpression;
  if (!formula) return null;

  return evaluateSpreadsheetFormula(formula, targetRow, spreadsheet.columns);
};

export const calculateSpreadsheetFormulaColumnValues = (
  spreadsheet: Pick<HomeFinSpreadsheet, 'columns' | 'rows'>,
  columnId: string
): Array<number | null> => spreadsheet.rows.map((row) => calculateSpreadsheetColumnFormula(spreadsheet, columnId, row));

export const validateSpreadsheetFormula = (
  expression: string | null | undefined,
  columns: SpreadsheetColumn[]
): boolean => {
  if (!expression || !expression.trim()) return false;
  const tokens = tokenizeSpreadsheetFormula(expression);
  if (!tokens.length) return false;

  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(normalizeSpreadsheetFormulaReference(column.id), column.id);
    lookup.set(normalizeSpreadsheetFormulaReference(column.name), column.id);
  }

  for (const token of tokens) {
    if (token === '+' || token === '-' || token === '*' || token === '/' || token === '(' || token === ')') continue;
    if (/^[-+]?\d+(?:[.,]\d+)?$/.test(token)) continue;
    if (!lookup.has(normalizeSpreadsheetFormulaReference(token))) return false;
  }

  return true;
};
