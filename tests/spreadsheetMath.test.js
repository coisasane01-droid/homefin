import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSpreadsheetCommission,
  calculateSpreadsheetCommissionBase,
  calculateSpreadsheetTotal,
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
