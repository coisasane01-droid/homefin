import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  FilePlus2,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { jsPDF as JsPDFDocument } from 'jspdf';
import { formatCurrency } from '../utils';
import { spreadsheetsService } from '../services/spreadsheets';
import {
  calculateSpreadsheetRowTotal,
  calculateSpreadsheetTotal,
  hasInvalidSpreadsheetCurrency,
  parseSpreadsheetCurrency,
} from '../services/spreadsheetMath';
import type {
  HomeFinSpreadsheet,
  SpreadsheetColumn,
  SpreadsheetColumnType,
  SpreadsheetRow,
} from '../types/spreadsheets';

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const createInitialColumns = (): SpreadsheetColumn[] => [
  { id: crypto.randomUUID(), name: 'Balanceamento', type: 'currency' },
  { id: crypto.randomUUID(), name: 'Cambagem', type: 'currency' },
  { id: crypto.randomUUID(), name: 'Alinhamento', type: 'currency' },
  { id: crypto.randomUUID(), name: 'Mão de obra', type: 'currency' },
  { id: crypto.randomUUID(), name: 'Marca do carro', type: 'text' },
  { id: crypto.randomUUID(), name: 'Pneus', type: 'currency' },
  { id: crypto.randomUUID(), name: 'Outros', type: 'currency' },
];

const emptyRow = (columns: SpreadsheetColumn[]): SpreadsheetRow => ({
  id: crypto.randomUUID(),
  cells: Object.fromEntries(columns.map((column) => [column.id, ''])),
});

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const formatSpreadsheetTotal = (value: number | null) =>
  value === null ? 'Corrija os valores' : formatCurrency(value);

const createSpreadsheet = (): HomeFinSpreadsheet => {
  const now = new Date().toISOString();
  const columns = createInitialColumns();
  return {
    id: crypto.randomUUID(),
    name: '',
    referenceMonth: new Date().getMonth() + 1,
    referenceYear: new Date().getFullYear(),
    columns,
    rows: [emptyRow(columns)],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
};

const Spreadsheets: React.FC = () => {
  const familyId = localStorage.getItem('homefin_current_family_id') || '';
  const [records, setRecords] = useState<HomeFinSpreadsheet[]>([]);
  const [selected, setSelected] = useState<HomeFinSpreadsheet | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInCloud, setSavedInCloud] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [columnModal, setColumnModal] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [columnType, setColumnType] = useState<SpreadsheetColumnType>('text');

  const loadRecords = async () => {
    if (!familyId || familyId === 'v1') {
      setLoading(false);
      setSyncError('Entre na sua família para acessar as planilhas.');
      return;
    }

    try {
      const result = await spreadsheetsService.load(familyId);
      setRecords(result.records);
      setCloudAvailable(result.synced);
      setSyncError(result.error || '');
      setSavedInCloud(result.synced);
    } catch (error) {
      setCloudAvailable(false);
      setSavedInCloud(false);
      setSyncError(error instanceof Error ? error.message : 'Não foi possível carregar as planilhas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
    const handleOnline = () => void loadRecords();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return records.filter((record) => {
      if (!query) return true;
      const monthName = monthNames[record.referenceMonth - 1] || '';
      return [
        record.name,
        monthName,
        String(record.referenceMonth).padStart(2, '0'),
        String(record.referenceYear),
      ].some((value) => value.toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [records, search]);

  const updateSelected = (update: Partial<HomeFinSpreadsheet>) => {
    if (saving) return;
    setSelected((current) => current ? { ...current, ...update } : current);
    setDirty(true);
    setSavedInCloud(false);
    setSyncError('');
  };

  const canLeaveCurrent = () =>
    !dirty || window.confirm('Há alterações não salvas. Deseja descartá-las?');

  const handleNew = () => {
    if (saving) return;
    if (!familyId || familyId === 'v1') {
      setSyncError('Entre na sua família antes de criar uma planilha.');
      return;
    }
    if (!canLeaveCurrent()) return;
    setSelected(createSpreadsheet());
    setDirty(true);
    setSavedInCloud(false);
    setSyncError('');
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    if (!familyId || familyId === 'v1') {
      setSyncError('Entre na sua família antes de salvar uma planilha.');
      return;
    }
    if (!selected.name.trim()) {
      setSyncError('Informe um nome para a planilha antes de salvar.');
      return;
    }
    if (hasInvalidSpreadsheetCurrency(selected)) {
      setSyncError('Corrija os valores monetários inválidos antes de salvar.');
      return;
    }

    setSaving(true);
    setSyncError('');
    try {
      const result = await spreadsheetsService.save(familyId, selected);
      const saved = { ...selected, updatedAt: new Date().toISOString() };
      setSelected(saved);
      setRecords((current) => [
        saved,
        ...current.filter((record) => record.id !== saved.id),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setDirty(false);
      setSavedInCloud(result.synced);
      setCloudAvailable(result.synced);
      setSyncError(result.error || (!result.synced
        ? 'Alterações guardadas neste dispositivo; a nuvem ainda não confirmou o salvamento.'
        : ''));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível salvar a planilha.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (spreadsheet: HomeFinSpreadsheet) => {
    if (saving) return;
    if (!familyId || familyId === 'v1') {
      setSyncError('Entre na sua família antes de excluir uma planilha.');
      return;
    }
    if (!window.confirm(`Excluir a planilha "${spreadsheet.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const result = await spreadsheetsService.delete(familyId, spreadsheet.id);
      setRecords((current) => current.filter((record) => record.id !== spreadsheet.id));
      if (selected?.id === spreadsheet.id) {
        setSelected(null);
        setDirty(false);
      }
      setSavedInCloud(result.synced);
      setCloudAvailable(result.synced);
      setSyncError(result.error || (!result.synced
        ? 'Exclusão guardada neste dispositivo; a nuvem ainda não confirmou a operação.'
        : ''));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível excluir a planilha.');
    }
  };

  const handleDuplicate = async () => {
    if (!selected || saving) return;
    const duplicatedColumns = selected.columns.map((column) => ({
      ...column,
      id: crypto.randomUUID(),
    }));
    const duplicate: HomeFinSpreadsheet = {
      ...selected,
      id: crypto.randomUUID(),
      name: `${selected.name} (cópia)`.slice(0, 120),
      columns: duplicatedColumns,
      rows: selected.rows.map((row) => ({
        id: crypto.randomUUID(),
        cells: Object.fromEntries(
          selected.columns.map((column, index) => [
            duplicatedColumns[index].id,
            row.cells[column.id] || '',
          ])
        ),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSelected(duplicate);
    setDirty(true);
    setSavedInCloud(false);
    setSyncError('');
  };

  const handleAddRow = () => {
    if (!selected) return;
    updateSelected({ rows: [...selected.rows, emptyRow(selected.columns)] });
  };

  const handleCellChange = (rowId: string, columnId: string, value: string) => {
    if (!selected) return;
    updateSelected({
      rows: selected.rows.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [columnId]: value } }
          : row
      ),
    });
  };

  const handleDeleteRow = (row: SpreadsheetRow) => {
    if (!selected) return;
    const hasContent = Object.values(row.cells).some((value) => value.trim());
    if (hasContent && !window.confirm('Excluir esta linha e seus dados?')) return;
    updateSelected({ rows: selected.rows.filter((item) => item.id !== row.id) });
  };

  const handleAddColumn = () => {
    const name = columnName.trim();
    if (!selected || !name) return;
    const column: SpreadsheetColumn = {
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      type: columnType,
    };
    updateSelected({
      columns: [...selected.columns, column],
      rows: selected.rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [column.id]: '' },
      })),
    });
    setColumnName('');
    setColumnType('text');
    setColumnModal(false);
  };

  const handleRenameColumn = (column: SpreadsheetColumn) => {
    if (!selected) return;
    const name = window.prompt('Novo nome da coluna:', column.name)?.trim();
    if (!name || name === column.name) return;
    updateSelected({
      columns: selected.columns.map((item) =>
        item.id === column.id ? { ...item, name: name.slice(0, 80) } : item
      ),
    });
  };

  const handleDeleteColumn = (column: SpreadsheetColumn) => {
    if (!selected || selected.columns.length === 1) {
      setSyncError('A planilha precisa manter ao menos uma coluna.');
      return;
    }
    const hasContent = selected.rows.some((row) => (row.cells[column.id] || '').trim());
    if (hasContent && !window.confirm(`Excluir a coluna "${column.name}" e todos os seus valores?`)) {
      return;
    }
    updateSelected({
      columns: selected.columns.filter((item) => item.id !== column.id),
      rows: selected.rows.map((row) => {
        const cells = { ...row.cells };
        delete cells[column.id];
        return { ...row, cells };
      }),
    });
  };

  const handleExportPdf = async () => {
    if (!selected) return;
    if (hasInvalidSpreadsheetCurrency(selected)) {
      setSyncError('Corrija os valores monetários inválidos antes de exportar o PDF.');
      return;
    }
    try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const emittedAt = new Date().toLocaleDateString('pt-BR');
    const columnTitles = [...selected.columns.map((column) => column.name), 'Total'];
    const body = selected.rows.map((row) => [
      ...selected.columns.map((column) =>
        column.type === 'currency'
          ? formatCurrency(parseSpreadsheetCurrency(row.cells[column.id] || '') || 0)
          : row.cells[column.id] || ''
      ),
      formatSpreadsheetTotal(calculateSpreadsheetRowTotal(row, selected.columns)),
    ]);

    doc.setTextColor(55, 48, 163);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('HomeFin | Planilhas', 14, 15);
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.text(selected.name || 'Planilha sem nome', 14, 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Referência: ${monthNames[selected.referenceMonth - 1]} de ${selected.referenceYear}  |  Criada em: ${formatDate(selected.createdAt)}  |  Emitida em: ${emittedAt}`,
      14,
      30
    );

    autoTable(doc, {
      startY: 36,
      head: [columnTitles],
      body,
      theme: 'grid',
      margin: { left: 14, right: 14, top: 36, bottom: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(
        columnTitles.map((_, index) => [index, { cellWidth: 'wrap' as const }])
      ),
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 0,
      showHead: 'everyPage',
    });

    const tableDocument = doc as JsPDFDocument & { lastAutoTable?: { finalY: number } };
    const finalY = tableDocument.lastAutoTable?.finalY || 40;
    const pageHeight = doc.internal.pageSize.getHeight();
    let summaryY = finalY + 9;
    const writeContinuationHeader = (title: string) => {
      doc.setTextColor(55, 48, 163);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('HomeFin | Planilhas', 14, 14);
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(9);
      doc.text(`${selected.name || 'Planilha sem nome'} — ${title}`, 14, 21);
      return 30;
    };

    if (summaryY > pageHeight - 16) {
      doc.addPage();
      summaryY = writeContinuationHeader('Resumo');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(55, 48, 163);
    doc.text(`Total geral: ${formatSpreadsheetTotal(calculateSpreadsheetTotal(selected))}`, 14, summaryY);

    if (selected.notes.trim()) {
      const notes = doc.splitTextToSize(
        `Observações: ${selected.notes}`,
        doc.internal.pageSize.getWidth() - 28
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      let notesY = summaryY + 8;
      for (const line of notes) {
        if (notesY > pageHeight - 14) {
          doc.addPage();
          notesY = writeContinuationHeader('Observações');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(55, 65, 81);
        }
        doc.text(line, 14, notesY);
        notesY += 4;
      }
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('HomeFin', 14, pageHeight - 6);
      doc.text(`${page}/${pageCount}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
    }

    const safeName = (selected.name || 'Sem_nome')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    doc.save(
      `Planilha_${safeName}_${monthNames[selected.referenceMonth - 1]}_${selected.referenceYear}.pdf`
    );
    } catch (error) {
      setSyncError(error instanceof Error ? `Não foi possível gerar o PDF: ${error.message}` : 'Não foi possível gerar o PDF.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {columnModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nova coluna</h2>
              <button onClick={() => setColumnModal(false)} aria-label="Fechar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
            <label className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nome
              <input
                autoFocus
                maxLength={80}
                value={columnName}
                onChange={(event) => setColumnName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="Ex.: Modelo do veículo"
              />
            </label>
            <label className="mb-6 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo de informação
              <select
                value={columnType}
                onChange={(event) => setColumnType(event.target.value as SpreadsheetColumnType)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="text">Texto / descrição</option>
                <option value="currency">Valor em R$ (entra no total)</option>
              </select>
            </label>
            <button onClick={handleAddColumn} disabled={!columnName.trim()} className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
              Adicionar coluna
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-primary-600 dark:text-primary-400">Organização e serviços</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Planilhas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Registre serviços, acompanhe valores e mantenha tudo organizado.
          </p>
        </div>
        <button onClick={handleNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-primary-700">
          <FilePlus2 size={19} /> Nova Planilha
        </button>
      </header>

      {syncError && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{syncError}</span>
          {familyId && familyId !== 'v1' && (
            <button onClick={() => void loadRecords()} className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 font-semibold hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40">
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Histórico</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pesquise por nome, mês ou ano.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar planilha..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <LoaderCircle size={18} className="animate-spin" /> Carregando planilhas...
          </div>
        ) : filteredRecords.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRecords.map((record) => (
              <button
                key={record.id}
                onClick={() => {
                  if (saving) return;
                  if (canLeaveCurrent()) {
                    setSelected(record);
                    setDirty(false);
                    setSavedInCloud(cloudAvailable);
                    setSyncError('');
                  }
                }}
                className={`rounded-xl border p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 ${
                  selected?.id === record.id
                    ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{record.name || 'Sem nome'}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {monthNames[record.referenceMonth - 1]} {record.referenceYear}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {formatSpreadsheetTotal(calculateSpreadsheetTotal(record))}
                  </span>
                </div>
                <p className="mt-3 text-xs text-gray-400">Criada em {formatDate(record.createdAt)}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            {records.length ? 'Nenhuma planilha corresponde à busca.' : 'Nenhuma planilha salva ainda.'}
          </div>
        )}
      </section>

      {selected && (
        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nome
                <input
                  value={selected.name}
                  onChange={(event) => updateSelected({ name: event.target.value })}
                  maxLength={120}
                  placeholder="Ex.: Serviços do veículo"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mês de referência
                <select
                  value={selected.referenceMonth}
                  onChange={(event) => updateSelected({ referenceMonth: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ano de referência
                <input
                  type="number"
                  min={2000}
                  max={9999}
                  value={selected.referenceYear}
                  onChange={(event) => updateSelected({ referenceYear: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Data de criação
                <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  {formatDate(selected.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDuplicate}
                title="Duplicar planilha"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Copy size={16} /> Duplicar
              </button>
              <button
                onClick={handleExportPdf}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Download size={16} /> Exportar PDF
              </button>
              <button
                onClick={() => void handleDelete(selected)}
                title="Excluir planilha"
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                <Trash2 size={16} /> Excluir
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total geral</p>
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{formatSpreadsheetTotal(calculateSpreadsheetTotal(selected))}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {saving ? (
                <><LoaderCircle size={17} className="animate-spin text-primary-600" /><span className="text-gray-600 dark:text-gray-300">Salvando...</span></>
              ) : dirty ? (
                <><CloudOff size={17} className="text-amber-600" /><span className="text-amber-700 dark:text-amber-300">Alterações não salvas</span></>
              ) : savedInCloud ? (
                <><Cloud size={17} className="text-emerald-600" /><span className="text-emerald-700 dark:text-emerald-300">Salvo na nuvem</span></>
              ) : (
                <><CloudOff size={17} className="text-amber-600" /><span className="text-amber-700 dark:text-amber-300">Salvo somente neste dispositivo</span></>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Lançamentos</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Role horizontalmente para ver todas as colunas.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setColumnModal(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                <Plus size={16} /> Nova coluna
              </button>
              <button onClick={handleAddRow} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                <Plus size={16} /> Nova linha
              </button>
            </div>
          </div>

          <div className="max-w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900">
                <tr>
                  <th className="w-12 border-b border-r border-gray-200 px-3 py-3 text-center font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">#</th>
                  {selected.columns.map((column) => (
                    <th key={column.id} className="min-w-[170px] border-b border-r border-gray-200 px-3 py-2 text-left dark:border-gray-700">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => handleRenameColumn(column)} className="truncate font-semibold text-gray-700 hover:text-primary-600 dark:text-gray-200">
                          {column.name}
                        </button>
                        <button onClick={() => handleDeleteColumn(column)} aria-label={`Excluir coluna ${column.name}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <span className="text-[11px] font-normal text-gray-400">{column.type === 'currency' ? 'Valor (R$)' : 'Texto'}</span>
                    </th>
                  ))}
                  <th className="min-w-[150px] border-b border-gray-200 bg-emerald-50 px-3 py-3 text-right font-bold text-emerald-800 dark:border-gray-700 dark:bg-emerald-900/30 dark:text-emerald-200">Total</th>
                  <th className="w-12 border-b border-gray-200 px-2 dark:border-gray-700" />
                </tr>
              </thead>
              <tbody>
                {selected.rows.map((row, rowIndex) => (
                  <tr key={row.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/60">
                    <td className="border-r border-b border-gray-200 px-3 py-2 text-center text-gray-400 dark:border-gray-700">{rowIndex + 1}</td>
                    {selected.columns.map((column) => (
                      <td key={column.id} className="border-r border-b border-gray-200 p-1.5 dark:border-gray-700">
                        {column.type === 'currency' ? (
                          <div className="flex items-center rounded-md border border-gray-200 bg-white focus-within:border-primary-400 dark:border-gray-600 dark:bg-gray-900">
                            <span className="pl-2 text-xs text-gray-400">R$</span>
                            <input
                              inputMode="decimal"
                              aria-label={`${column.name}, linha ${rowIndex + 1}`}
                              value={row.cells[column.id] || ''}
                              maxLength={2000}
                              onChange={(event) => handleCellChange(row.id, column.id, event.target.value)}
                              aria-invalid={parseSpreadsheetCurrency(row.cells[column.id] || '') === null}
                              placeholder="0,00"
                              className={`w-full min-w-0 rounded-md bg-transparent px-2 py-2 text-right outline-none dark:text-white ${
                                parseSpreadsheetCurrency(row.cells[column.id] || '') === null
                                  ? 'text-red-600'
                                  : 'text-gray-800'
                              }`}
                            />
                          </div>
                        ) : (
                          <input
                            aria-label={`${column.name}, linha ${rowIndex + 1}`}
                            value={row.cells[column.id] || ''}
                            maxLength={2000}
                            onChange={(event) => handleCellChange(row.id, column.id, event.target.value)}
                            className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-gray-800 outline-none focus:border-primary-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            placeholder="Digite aqui..."
                          />
                        )}
                      </td>
                    ))}
                    <td className="border-b border-gray-200 bg-emerald-50/60 px-3 py-2 text-right font-semibold text-emerald-800 dark:border-gray-700 dark:bg-emerald-900/10 dark:text-emerald-200">
                      {formatSpreadsheetTotal(calculateSpreadsheetRowTotal(row, selected.columns))}
                    </td>
                    <td className="border-b border-gray-200 px-2 dark:border-gray-700">
                      <button onClick={() => handleDeleteRow(row)} aria-label={`Excluir linha ${rowIndex + 1}`} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!selected.rows.length && (
                  <tr>
                    <td colSpan={selected.columns.length + 3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma linha. Use “Nova linha” para adicionar um lançamento.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold dark:bg-gray-900">
                  <td colSpan={selected.columns.length + 1} className="border-t border-gray-200 px-3 py-3 text-right text-gray-700 dark:border-gray-700 dark:text-gray-200">Total geral</td>
                  <td className="border-t border-gray-200 bg-emerald-100 px-3 py-3 text-right text-emerald-900 dark:border-gray-700 dark:bg-emerald-900/40 dark:text-emerald-100">{formatSpreadsheetTotal(calculateSpreadsheetTotal(selected))}</td>
                  <td className="border-t border-gray-200 dark:border-gray-700" />
                </tr>
              </tfoot>
            </table>
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Observações gerais
            <textarea
              value={selected.notes}
              onChange={(event) => updateSelected({ notes: event.target.value })}
              rows={3}
              maxLength={10000}
              placeholder="Adicione informações importantes sobre esta planilha..."
              className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </section>
      )}

      {!selected && !loading && records.length > 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Selecione uma planilha do histórico ou crie uma nova.
        </p>
      )}
    </div>
  );
};

export default Spreadsheets;
