import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSpreadsheetCommission,
  calculateSpreadsheetCommissionBase,
  calculateSpreadsheetTotal,
  parseSpreadsheetCommissionPercentage,
  SPREADSHEET_TOTAL_COMMISSION_BASE,
} from '../services/spreadsheetMath.ts';

const spreadsheet = {
  id: 'planilha',
  name: 'Teste',
  referenceMonth: 1,
  referenceYear: 2026,
  columns: [
    { id: 'servico', name: 'Serviço', type: 'currency' },
    { id: 'nome', name: 'Nome', type: 'text' },
    { id: 'base', name: 'Base da comissão', type: 'text' },
  ],
  rows: [
    { id: '1', cells: { servico: '100,00', nome: 'Ana', base: '50,00' } },
    { id: '2', cells: { servico: '25.50', nome: 'Beto', base: 'descrição' } },
    { id: '3', cells: { servico: '', nome: '', base: '' } },
  ],
  commissionEnabled: true,
  commissionColumnId: 'base',
  commissionPercentage: 10,
  notes: '',
  createdAt: '',
  updatedAt: '',
};

test('commission sums only numeric values in the selected column', () => {
  assert.equal(calculateSpreadsheetCommissionBase(spreadsheet, 'base'), 50);
  assert.equal(calculateSpreadsheetCommission(spreadsheet), 5);
});

test('commission remains separate from the spreadsheet total', () => {
  assert.equal(calculateSpreadsheetTotal(spreadsheet), 125.5);
  assert.equal(calculateSpreadsheetCommission(spreadsheet), 5);
});

test('commission can use the general total across all currency columns', () => {
  const withTotalBase = {
    ...spreadsheet,
    commissionColumnId: SPREADSHEET_TOTAL_COMMISSION_BASE,
    commissionPercentage: 10,
  };
  assert.equal(calculateSpreadsheetCommissionBase(withTotalBase, withTotalBase.commissionColumnId), 125.5);
  assert.equal(calculateSpreadsheetCommission(withTotalBase), 12.55);
  assert.equal(calculateSpreadsheetTotal(withTotalBase), 125.5);
});

test('general-total commission recalculates from edited cells and remains plan-specific', () => {
  const firstSheet = {
    ...spreadsheet,
    commissionColumnId: SPREADSHEET_TOTAL_COMMISSION_BASE,
    commissionPercentage: 10.5,
  };
  const secondSheet = {
    ...spreadsheet,
    commissionColumnId: SPREADSHEET_TOTAL_COMMISSION_BASE,
    commissionPercentage: 12.75,
    rows: [{ id: 'other', cells: { servico: '200,00', nome: '', base: '' } }],
  };

  assert.equal(calculateSpreadsheetCommission(firstSheet), 13.18);
  assert.equal(calculateSpreadsheetCommission(secondSheet), 25.5);
  assert.equal(calculateSpreadsheetCommission({
    ...firstSheet,
    rows: [{ ...firstSheet.rows[0], cells: { ...firstSheet.rows[0].cells, servico: '200,00' } }, ...firstSheet.rows.slice(1)],
  }), 23.68);
});

test('commission percentage accepts Brazilian decimal percentages from zero to one hundred', () => {
  for (const [value, expected] of [
    ['5', 5],
    ['10,5', 10.5],
    ['12,75', 12.75],
    ['15,5', 15.5],
    ['99,99', 99.99],
    ['100', 100],
  ]) {
    assert.equal(parseSpreadsheetCommissionPercentage(value), expected);
  }
  for (const value of ['-1', '100,01', '10,555', 'abc', '']) {
    assert.equal(parseSpreadsheetCommissionPercentage(value), null);
  }
});

test('commission rounds the money result only after applying the full percentage', () => {
  assert.equal(calculateSpreadsheetCommission({
    ...spreadsheet,
    commissionColumnId: 'servico',
    commissionPercentage: 12.75,
    rows: [{ id: '1', cells: { servico: '10,00' } }],
  }), 1.28);
});
