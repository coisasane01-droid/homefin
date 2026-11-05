export type SpreadsheetColumnType = 'text' | 'currency';

export interface SpreadsheetColumn {
  id: string;
  name: string;
  type: SpreadsheetColumnType;
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
  notes: string;
  createdAt: string;
  updatedAt: string;
}
