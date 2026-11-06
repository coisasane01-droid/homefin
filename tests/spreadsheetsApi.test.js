import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import spreadsheetsHandler from '../api/spreadsheets.js';
import { createFamilySessionToken } from '../api/_family-session.js';
import { SPREADSHEET_TOTAL_COMMISSION_BASE } from '../services/spreadsheetMath.ts';

process.env.HOMEFIN_SESSION_SECRET = 'test-secret-with-more-than-thirty-two-characters';
process.env.VITE_SUPABASE_URL = 'https://supabase.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function responseCapture() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

function makeSpreadsheet(id, percentage) {
  return {
    id,
    name: 'Comissão',
    referenceMonth: 11,
    referenceYear: 2026,
    columns: [
      { id: '00000000-0000-4000-8000-000000000001', name: 'Serviço A', type: 'currency' },
      { id: '00000000-0000-4000-8000-000000000002', name: 'Serviço B', type: 'currency' },
    ],
    rows: [],
    commissionEnabled: true,
    commissionColumnId: SPREADSHEET_TOTAL_COMMISSION_BASE,
    commissionPercentage: percentage,
    notes: '',
  };
}

test('Supabase API stores and reloads general-total commission per family', async () => {
  const savedRecords = [];
  global.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/homefin_family_credentials')) {
      return Response.json([{ session_version: 1 }]);
    }

    const familyId = url.searchParams.get('family_id')?.replace(/^eq\./, '');
    if (url.pathname.endsWith('/homefin_spreadsheets') && init.method === 'PATCH') {
      return Response.json([]);
    }
    if (url.pathname.endsWith('/homefin_spreadsheets') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      const saved = {
        ...body,
        created_at: '2026-11-06T00:00:00.000Z',
        updated_at: body.updated_at,
      };
      savedRecords.push(saved);
      return Response.json([saved]);
    }
    if (url.pathname.endsWith('/homefin_spreadsheets') && !init.method) {
      return Response.json(savedRecords.filter((record) => record.family_id === familyId));
    }
    throw new Error(`Unexpected Supabase request: ${init.method || 'GET'} ${url}`);
  };

  for (const [familyId, spreadsheetId, percentage] of [
    ['family-one', '00000000-0000-4000-8000-000000000011', 10.5],
    ['family-two', '00000000-0000-4000-8000-000000000022', 12.75],
  ]) {
    const token = createFamilySessionToken(familyId);
    const saveResponse = responseCapture();
    await spreadsheetsHandler({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { action: 'upsert', familyId, spreadsheet: makeSpreadsheet(spreadsheetId, percentage) },
    }, saveResponse);

    assert.equal(saveResponse.statusCode, 200);
    assert.equal(savedRecords.at(-1).family_id, familyId);
    assert.equal(savedRecords.at(-1).commission_column_id, SPREADSHEET_TOTAL_COMMISSION_BASE);

    const listResponse = responseCapture();
    await spreadsheetsHandler({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { action: 'list', familyId },
    }, listResponse);

    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.body.records.length, 1);
    assert.equal(listResponse.body.records[0].commissionColumnId, SPREADSHEET_TOTAL_COMMISSION_BASE);
    assert.equal(listResponse.body.records[0].commissionPercentage, percentage);
  }
});
