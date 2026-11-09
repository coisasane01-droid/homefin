export type SpreadsheetColumnType = 'text' | 'currency';

export interface SpreadsheetColumn {
  id: string;
  name: string;
  type: SpreadsheetColumnType;
  formula?: string | null;
  formulaExpression?: string | null;
}

export interface SpreadsheetRow {
  id: string;
  cells: Record<string, string>;
}

export interface HomeFinSpreadsheet {
  id: string;
  name: string;
  referenceMonth: number;
  referenceYear: number;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
  commissionEnabled?: boolean;
  commissionColumnId?: string | null;
  commissionPercentage?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
