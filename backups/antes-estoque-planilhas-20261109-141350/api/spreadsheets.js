import { validateFamilySession } from './_family-session.js';

const TOTAL_COMMISSION_BASE_ID = '__total_general__';
const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BRAZILIAN_CURRENCY_PATTERN = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const DECIMAL_CURRENCY_PATTERN = /^-?\d+\.\d{1,2}$/;

function validSpreadsheet(spreadsheet) {
  if (!spreadsheet || typeof spreadsheet !== 'object' || Array.isArray(spreadsheet)) {
    return false;
  }

  const { columns, rows } = spreadsheet;
  const commissionColumnId = spreadsheet.commissionColumnId ?? null;
  const commissionPercentage = spreadsheet.commissionPercentage ?? 0;
  if (
    !UUID_PATTERN.test(String(spreadsheet.id || '')) ||
    typeof spreadsheet.name !== 'string' ||
    !spreadsheet.name.trim() ||
    spreadsheet.name.length > 120 ||
    !Number.isInteger(spreadsheet.referenceMonth) ||
    spreadsheet.referenceMonth < 1 ||
    spreadsheet.referenceMonth > 12 ||
    !Number.isInteger(spreadsheet.referenceYear) ||
    spreadsheet.referenceYear < 2000 ||
    spreadsheet.referenceYear > 9999 ||
    typeof spreadsheet.notes !== 'string' ||
    spreadsheet.notes.length > 10000 ||
    !Array.isArray(columns) ||
    columns.length < 1 ||
    !Array.isArray(rows) ||
    (spreadsheet.commissionEnabled !== undefined && typeof spreadsheet.commissionEnabled !== 'boolean') ||
    (commissionColumnId !== null && typeof commissionColumnId !== 'string') ||
    !Number.isFinite(commissionPercentage) ||
    commissionPercentage < 0 ||
    commissionPercentage > 100
  ) {
    return false;
  }

  const columnIds = new Set();
  const currencyColumnIds = new Set();
  for (const column of columns) {
    if (
      !column ||
      typeof column.id !== 'string' ||
      !UUID_PATTERN.test(column.id) ||
      columnIds.has(column.id) ||
      typeof column.name !== 'string' ||
      !column.name.trim() ||
      column.name.length > 80 ||
      !['text', 'currency'].includes(column.type)
    ) {
      return false;
    }
    columnIds.add(column.id);
    if (column.type === 'currency') currencyColumnIds.add(column.id);
  }

  if (
    commissionColumnId !== null &&
    commissionColumnId !== TOTAL_COMMISSION_BASE_ID &&
    !columnIds.has(commissionColumnId)
  ) return false;
  if (spreadsheet.commissionEnabled && !commissionColumnId) return false;

  const rowIds = new Set();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !UUID_PATTERN.test(row.id) ||
      rowIds.has(row.id) ||
      !row.cells ||
      typeof row.cells !== 'object' ||
      Array.isArray(row.cells)
    ) {
      return false;
    }
    rowIds.add(row.id);

    for (const [columnId, value] of Object.entries(row.cells)) {
      if (!columnIds.has(columnId) || typeof value !== 'string' || value.length > 2000) {
        return false;
      }
      if (currencyColumnIds.has(columnId)) {
        const cleaned = value.replace(/R\$/gi, '').replace(/\s/g, '');
        if (
          cleaned &&
          !BRAZILIAN_CURRENCY_PATTERN.test(cleaned) &&
          !DECIMAL_CURRENCY_PATTERN.test(cleaned)
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function toSpreadsheet(row) {
  return {
    id: row.id,
    name: row.name,
    referenceMonth: row.reference_month,
    referenceYear: row.reference_year,
    columns: row.columns,
    rows: row.rows,
    commissionEnabled: row.commission_enabled ?? false,
    commissionColumnId: row.commission_column_id,
    commissionPercentage: Number(row.commission_percentage ?? 0),
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração segura do Supabase indisponível.');
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        ...(options.headers || {}),
      },
    }
  );
  const text = await response.text();

  if (!response.ok) {
    console.error('Falha ao acessar planilhas no Supabase:', response.status);
    let responseError = null;
    try {
      responseError = text ? JSON.parse(text) : null;
    } catch {
      responseError = null;
    }
    const error = new Error('Não foi possível acessar as planilhas na nuvem.');
    error.code = responseError?.code;
    error.details = `${responseError?.message || ''} ${responseError?.details || ''}`;
    throw error;
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do serviço de planilhas.');
  }
}

function isMissingCommissionColumns(error) {
  return /commission_(enabled|column_id|percentage)/i.test(
    `${error?.message || ''} ${error?.details || ''}`
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { action, familyId, spreadsheet, id } = req.body || {};
  if (typeof familyId !== 'string' || !FAMILY_ID_PATTERN.test(familyId)) {
    return res.status(400).json({ error: 'Identificador familiar inválido.' });
  }

  let session;
  try {
    session = await validateFamilySession(req, familyId);
  } catch (error) {
    console.error('Falha ao validar sessão de planilhas:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(503).json({ error: 'Não foi possível validar a sessão familiar.' });
  }
  if (!session.valid) {
    return res.status(401).json({ error: session.error || 'Sessão inválida.' });
  }

  if (!['list', 'upsert', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Operação de planilha inválida.' });
  }
  if (action === 'upsert' && !validSpreadsheet(spreadsheet)) {
    return res.status(400).json({ error: 'Dados da planilha inválidos.' });
  }
  if (action === 'upsert' && Buffer.byteLength(JSON.stringify(spreadsheet), 'utf8') > 3500000) {
    return res.status(413).json({ error: 'A planilha excede o tamanho permitido.' });
  }
  if (action === 'delete' && !UUID_PATTERN.test(String(id || ''))) {
    return res.status(400).json({ error: 'Identificador da planilha inválido.' });
  }

  try {
    const query = new URLSearchParams();
    query.set('family_id', `eq.${familyId}`);

    if (action === 'list') {
      query.set('select', 'id,name,reference_month,reference_year,columns,rows,commission_enabled,commission_column_id,commission_percentage,notes,created_at,updated_at');
      query.set('order', 'updated_at.desc');
      let rows;
      try {
        rows = await supabaseRequest(`homefin_spreadsheets?${query}`);
      } catch (error) {
        if (!isMissingCommissionColumns(error)) throw error;
        query.set('select', 'id,name,reference_month,reference_year,columns,rows,notes,created_at,updated_at');
        rows = await supabaseRequest(`homefin_spreadsheets?${query}`);
      }
      return res.status(200).json({ records: rows.map(toSpreadsheet) });
    }

    if (action === 'delete') {
      query.set('id', `eq.${id}`);
      await supabaseRequest(`homefin_spreadsheets?${query}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return res.status(200).json({ success: true });
    }

    const values = {
      id: spreadsheet.id,
      family_id: familyId,
      name: spreadsheet.name.trim(),
      reference_month: spreadsheet.referenceMonth,
      reference_year: spreadsheet.referenceYear,
      columns: spreadsheet.columns,
      rows: spreadsheet.rows,
      commission_enabled: spreadsheet.commissionEnabled ?? false,
      commission_column_id: spreadsheet.commissionColumnId || null,
      commission_percentage: spreadsheet.commissionPercentage ?? 0,
      notes: spreadsheet.notes,
      updated_at: new Date().toISOString(),
    };
    query.set('id', `eq.${spreadsheet.id}`);
    const saveValues = async (record) => {
      const updated = await supabaseRequest(`homefin_spreadsheets?${query}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(record),
      });
      return updated?.length
        ? updated
        : await supabaseRequest('homefin_spreadsheets', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(record),
          });
    };

    let result;
    try {
      result = await saveValues(values);
    } catch (error) {
      if (!isMissingCommissionColumns(error)) throw error;
      if (
        spreadsheet.commissionEnabled ||
        spreadsheet.commissionColumnId ||
        Number(spreadsheet.commissionPercentage ?? 0) !== 0
      ) {
        throw new Error('Para sincronizar a comissão, execute a migração scripts/migracao-planilhas-comissao.sql no Supabase.');
      }
      const { commission_enabled: _enabled, commission_column_id: _column, commission_percentage: _percentage, ...legacyValues } = values;
      result = await saveValues(legacyValues);
    }

    if (!Array.isArray(result) || !result[0]) {
      return res.status(502).json({ error: 'O Supabase não confirmou o salvamento da planilha.' });
    }
    return res.status(200).json({ records: [toSpreadsheet(result[0])] });
  } catch (error) {
    console.error(
      'Erro na operação de planilhas:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao acessar planilhas na nuvem.',
    });
  }
}
