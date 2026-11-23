import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  Settings2,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  FilePlus2,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { jsPDF as JsPDFDocument } from 'jspdf';
import { formatCurrency } from '../utils';
import { spreadsheetsService } from '../services/spreadsheets';
import {
  calculateSpreadsheetRowTotal,
  calculateSpreadsheetTotal,
  calculateSpreadsheetCommission,
  calculateSpreadsheetCommissionBase,
  calculateSpreadsheetUnitCommission,
  calculateSpreadsheetUnitCommissionQuantity,
  calculateSpreadsheetExtraCommission,
  hasInvalidSpreadsheetExtraCommission,
  hasInvalidSpreadsheetCurrency,
  parseSpreadsheetCommissionPercentage,
  parseSpreadsheetCurrency,
  SPREADSHEET_TOTAL_COMMISSION_BASE,
  calculateSpreadsheetColumnFormula,
  calculateSpreadsheetColumnTotal,
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

const isSpreadsheetDateColumn = (column: SpreadsheetColumn): boolean => column.type === 'text' && /^(data|data do servi[cç]o|data da venda|data do lan[cç]amento)$/i.test(column.name.trim());
const getTodaySpreadsheetDate = (): string => new Date().toLocaleDateString('pt-BR');
const emptyRow = (columns: SpreadsheetColumn[]): SpreadsheetRow => ({
  id: crypto.randomUUID(),
  cells: Object.fromEntries(columns.map((column) => [column.id, isSpreadsheetDateColumn(column) ? getTodaySpreadsheetDate() : ''])),
});

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const formatSpreadsheetTotal = (value: number | null) =>
  value === null ? 'Corrija os valores' : formatCurrency(value);

const moveItem = <T,>(
  items: T[],
  sourceIndex: number,
  targetIndex: number,
  before: boolean
): T[] => {
  const reordered = [...items];
  const [item] = reordered.splice(sourceIndex, 1);
  let insertionIndex = targetIndex + (before ? 0 : 1);
  if (sourceIndex < insertionIndex) insertionIndex -= 1;
  reordered.splice(insertionIndex, 0, item);
  return reordered;
};

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
    commissionEnabled: false,
    commissionColumnId: null,
    commissionPercentage: 0,
    unitCommissionEnabled: false,
    unitCommissionColumnId: null,
    unitCommissionAmount: 0,
    extraCommissionEnabled: false,
    extraCommissionOriginalColumnId: null,
    extraCommissionSaleColumnId: null,
    extraCommissionQuantityColumnId: null,
    extraCommissionMode: 'percentage',
    extraCommissionRate: 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
};

const createExampleSpreadsheet = (): HomeFinSpreadsheet => {
  const now = new Date().toISOString();
  const columns: SpreadsheetColumn[] = [
    { id: crypto.randomUUID(), name: 'Nome', type: 'text' },
    { id: crypto.randomUUID(), name: 'Serviço', type: 'text' },
    { id: crypto.randomUUID(), name: 'Alinhamento', type: 'currency' },
    { id: crypto.randomUUID(), name: 'Mão de obra', type: 'currency' },
    { id: crypto.randomUUID(), name: 'Observações', type: 'text' },
  ];
  const rows: SpreadsheetRow[] = [
    {
      id: crypto.randomUUID(),
      cells: {
        [columns[0].id]: 'Ana Souza',
        [columns[1].id]: 'Revisão',
        [columns[2].id]: '180,00',
        [columns[3].id]: '120,00',
        [columns[4].id]: 'Exemplo editável',
      },
    },
    {
      id: crypto.randomUUID(),
      cells: {
        [columns[0].id]: 'Bruno Lima',
        [columns[1].id]: 'Balanceamento',
        [columns[2].id]: '250,00',
        [columns[3].id]: '150,00',
        [columns[4].id]: '',
      },
    },
  ];
  return {
    id: crypto.randomUUID(),
    name: 'Planilha de exemplo',
    referenceMonth: new Date().getMonth() + 1,
    referenceYear: new Date().getFullYear(),
    columns,
    rows,
    commissionEnabled: true,
    commissionColumnId: columns[2].id,
    commissionPercentage: 10,
    notes: 'Esta planilha é um exemplo: personalize ou exclua quando quiser.',
    createdAt: now,
    updatedAt: now,
  };
};

type SpreadsheetDragKind = 'column' | 'row';

interface SpreadsheetDragSession {
  pointerId: number;
  kind: SpreadsheetDragKind;
  sourceId: string;
  startX: number;
  startY: number;
  active: boolean;
  targetId: string;
  before: boolean;
  sourceElement: HTMLButtonElement;
}

const DragHandleIcon: React.FC = () => (
  <svg aria-hidden="true" viewBox="0 0 16 20" className="h-5 w-4 fill-current">
    {[3, 10, 17].flatMap((y) => [4, 12].map((x) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />
    )))}
  </svg>
);

const Spreadsheets: React.FC = () => {
  const familyId = localStorage.getItem('homefin_current_family_id') || '';
  const [records, setRecords] = useState<HomeFinSpreadsheet[]>([]);
  const [selected, setSelected] = useState<HomeFinSpreadsheet | null>(null);
  const [search, setSearch] = useState('');
  const [rowSearch, setRowSearch] = useState('');
  const [quickEntry, setQuickEntry] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInCloud, setSavedInCloud] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [columnModal, setColumnModal] = useState(false);
  const [pdfExportModalOpen, setPdfExportModalOpen] = useState(false);
  const [pdfSelectedColumnIds, setPdfSelectedColumnIds] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commissionSettingsOpen, setCommissionSettingsOpen] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [columnType, setColumnType] = useState<SpreadsheetColumnType>('text');
  const [formulaModalColumnId, setFormulaModalColumnId] = useState<string | null>(null);
  const [formulaMode, setFormulaMode] = useState<'row' | 'column'>('row');
  const [formulaSourceColumnId, setFormulaSourceColumnId] = useState('');
  const [formulaOperator, setFormulaOperator] = useState<'+' | '-' | '*' | '/'>('+');
  const [formulaSecondColumnId, setFormulaSecondColumnId] = useState('');
  const [commissionInput, setCommissionInput] = useState('0');
  const [commissionInputError, setCommissionInputError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [showExampleNotice, setShowExampleNotice] = useState(false);
  const [dragging, setDragging] = useState<{
    kind: SpreadsheetDragKind;
    sourceId: string;
    targetId: string;
    before: boolean;
  } | null>(null);
  const dragSession = useRef<SpreadsheetDragSession | null>(null);
  const dragTimer = useRef<number | null>(null);
  const exampleCreationStarted = useRef(false);

  useEffect(() => {
    setCommissionInput(String(selected?.commissionPercentage ?? 0).replace('.', ','));
    setCommissionInputError('');
  }, [selected?.id]);

  const loadRecords = async () => {
    if (!familyId || familyId === 'v1') {
      setLoading(false);
      setSyncError('Entre na sua família para acessar as planilhas.');
      return;
    }

    try {
      const result = await spreadsheetsService.load(familyId);
      let loadedRecords = result.records;
      let exampleSaveResult: { synced: boolean; error?: string } | null = null;
      if (result.synced && loadedRecords.length === 0 && !exampleCreationStarted.current) {
        exampleCreationStarted.current = true;
        const example = createExampleSpreadsheet();
        exampleSaveResult = await spreadsheetsService.save(familyId, example);
        const persistedExample = { ...example, updatedAt: new Date().toISOString() };
        loadedRecords = [persistedExample];
        setSelected(persistedExample);
        setDirty(false);
        setShowExampleNotice(true);
      }
      setRecords(loadedRecords);
      setCloudAvailable(exampleSaveResult ? exampleSaveResult.synced : result.synced);
      setSavedInCloud(exampleSaveResult ? exampleSaveResult.synced : result.synced);
      setSyncError(exampleSaveResult?.error || result.error || '');
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
    return () => {
      window.removeEventListener('online', handleOnline);
      if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    };
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

  const filteredRows = useMemo(() => {
    if (!selected) return [];

    const normalize = (value: string) =>
      value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

    const query = normalize(rowSearch);
    if (!query) return selected.rows;

    return selected.rows.filter((row) =>
      selected.columns.some((column) => {
        const raw = row.cells[column.id] || '';
        const formula = column.formulaExpression || column.formula;
        const hasRowFormula = column.formulaConfig?.mode === 'row' || !!formula;
        const calculated = hasRowFormula
          ? calculateSpreadsheetColumnFormula(selected, column.id, row)
          : null;

        const values = [column.name, raw];

        if (hasRowFormula && calculated !== null && Number.isFinite(calculated)) {
          values.push(String(calculated), formatCurrency(calculated));
        }

        if (column.type === 'currency' && !column.formulaConfig && !formula) {
          const amount = parseSpreadsheetCurrency(raw);
          if (amount !== null) {
            values.push(String(amount), formatCurrency(amount));
          }
        }

        return values.some((value) => normalize(value).includes(query));
      })
    );
  }, [selected, rowSearch]);

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

    const hasInvalidUnitQuantity = (sheet: HomeFinSpreadsheet): boolean => {
    if (!sheet.unitCommissionEnabled) return false;

    const column = sheet.columns.find(
      item => item.id === sheet.unitCommissionColumnId
    );

    if (!column || column.type !== 'text') return true;

    return sheet.rows.some(row => {
      const raw = String(row.cells[column.id] ?? '').trim();
      if (!raw) return false;

      const normalized = raw.replace(/\s/g, '').replace(',', '.');

      if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return true;

      const quantity = Number(normalized);
      return !Number.isFinite(quantity) || quantity > 99999999999;
    });
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
    if (hasInvalidSpreadsheetExtraCommission(selected)) {
      setSyncError('Confira as colunas, quantidades, preços e taxa da comissão extra.');
      return;
    }
    if (hasInvalidUnitQuantity(selected)) {
      setSyncError('Corrija as quantidades inválidas antes de salvar.');
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
      commissionColumnId: selected.commissionColumnId
        ? selected.commissionColumnId === SPREADSHEET_TOTAL_COMMISSION_BASE
          ? SPREADSHEET_TOTAL_COMMISSION_BASE
          : duplicatedColumns[selected.columns.findIndex((column) => column.id === selected.commissionColumnId)]?.id || null
        : null,
      unitCommissionColumnId: selected.unitCommissionColumnId
        ? duplicatedColumns[
            selected.columns.findIndex(
              (column) => column.id === selected.unitCommissionColumnId
            )
          ]?.id || null
        : null,
      extraCommissionOriginalColumnId: selected.extraCommissionOriginalColumnId
        ? duplicatedColumns[selected.columns.findIndex(c => c.id === selected.extraCommissionOriginalColumnId)]?.id || null : null,
      extraCommissionSaleColumnId: selected.extraCommissionSaleColumnId
        ? duplicatedColumns[selected.columns.findIndex(c => c.id === selected.extraCommissionSaleColumnId)]?.id || null : null,
      extraCommissionQuantityColumnId: selected.extraCommissionQuantityColumnId
        ? duplicatedColumns[selected.columns.findIndex(c => c.id === selected.extraCommissionQuantityColumnId)]?.id || null : null,
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
  const moveColumnBy = (id: string, direction: -1 | 1) => {
    if (!selected) return;
    const index = selected.columns.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.columns.length) return;
    updateSelected({ columns: moveItem(selected.columns, index, target, direction < 0) });
  };
  const moveRowBy = (id: string, direction: -1 | 1) => {
    if (!selected) return;
    const index = selected.rows.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.rows.length) return;
    updateSelected({ rows: moveItem(selected.rows, index, target, direction < 0) });
  };

  const handleAddQuickEntry = () => {
    if (!selected || saving) return;

    const hasContent = selected.columns.some(
      (column) => (quickEntry[column.id] || '').trim() !== ''
    );

    if (!hasContent) {
      setSyncError('Preencha pelo menos um campo antes de adicionar o lançamento.');
      return;
    }

    for (const column of selected.columns) {
      const value = (quickEntry[column.id] || '').trim();
      if (
        column.type === 'currency' &&
        !column.formulaConfig &&
        !column.formulaExpression &&
        !column.formula &&
        value !== '' &&
        parseSpreadsheetCurrency(value) === null
      ) {
        setSyncError(`Confira o valor informado na coluna "${column.name}".`);
        return;
      }
    }

    const cells = Object.fromEntries(
      selected.columns.map((column) => [
        column.id,
        column.formulaConfig || column.formulaExpression || column.formula
          ? ''
          : (quickEntry[column.id] || '').trim(),
      ])
    );

    updateSelected({
      rows: [...selected.rows, { id: crypto.randomUUID(), cells }],
    });

    setQuickEntry({});
    setRowSearch('');
    setSyncError('');
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

  const finishDrag = (session: SpreadsheetDragSession) => {
    if (!selected || session.sourceId === session.targetId) return;
    if (session.kind === 'column') {
      const sourceIndex = selected.columns.findIndex((item) => item.id === session.sourceId);
      const targetIndex = selected.columns.findIndex((item) => item.id === session.targetId);
      if (sourceIndex >= 0 && targetIndex >= 0) {
        updateSelected({
          columns: moveItem(selected.columns, sourceIndex, targetIndex, session.before),
        });
      }
    } else {
      const sourceIndex = selected.rows.findIndex((item) => item.id === session.sourceId);
      const targetIndex = selected.rows.findIndex((item) => item.id === session.targetId);
      if (sourceIndex >= 0 && targetIndex >= 0) {
        updateSelected({
          rows: moveItem(selected.rows, sourceIndex, targetIndex, session.before),
        });
      }
    }
  };

  const handleDragPointerDown = (
    kind: SpreadsheetDragKind,
    sourceId: string,
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (saving || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const session: SpreadsheetDragSession = {
      pointerId: event.pointerId,
      kind,
      sourceId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      targetId: sourceId,
      before: false,
      sourceElement: event.currentTarget,
    };
    dragSession.current = session;
    dragTimer.current = window.setTimeout(() => {
      if (dragSession.current !== session) return;
      session.active = true;
      if ('vibrate' in navigator) navigator.vibrate?.(15);
      setDragging({
        kind: session.kind,
        sourceId: session.sourceId,
        targetId: session.sourceId,
        before: false,
      });
    }, event.pointerType === 'touch' ? 120 : 0);
  };

  const handleDragPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.active) return;

    event.preventDefault();
    const selector = session.kind === 'column' ? '[data-column-id]' : '[data-row-id]';
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(selector);
    const targetId = target?.dataset[session.kind === 'column' ? 'columnId' : 'rowId'];
    if (!target || !targetId) {
      session.targetId = '';
      setDragging({
        kind: session.kind,
        sourceId: session.sourceId,
        targetId: '',
        before: false,
      });
      return;
    }
    const rect = target.getBoundingClientRect();
    session.targetId = targetId;
    session.before = session.kind === 'column'
      ? event.clientX < rect.left + rect.width / 2
      : event.clientY < rect.top + rect.height / 2;
    setDragging({
      kind: session.kind,
      sourceId: session.sourceId,
      targetId: session.targetId,
      before: session.before,
    });
  };

  const handleDragPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    dragTimer.current = null;
    dragSession.current = null;
    setDragging(null);
    if (session.active && session.targetId) {
      finishDrag(session);
      if ('vibrate' in navigator) navigator.vibrate?.([10, 35, 10]);
    }
  };

  const handleDragPointerCancel = () => {
    if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    dragTimer.current = null;
    dragSession.current = null;
    setDragging(null);
  };

  const cancelDrag = () => {
    const session = dragSession.current;
    if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    dragTimer.current = null;
    dragSession.current = null;
    setDragging(null);
    if (session?.sourceElement.hasPointerCapture(session.pointerId)) {
      session.sourceElement.releasePointerCapture(session.pointerId);
    }
  };

  useEffect(() => {
    const handleDragKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragSession.current) cancelDrag();
    };
    document.addEventListener('keydown', handleDragKeyDown);
    return () => document.removeEventListener('keydown', handleDragKeyDown);
  }, []);

  const handleCommissionPercentageChange = (rawValue: string) => {
    const withComma = rawValue.replace(/\./g, ',');
    if (!/^\d*(?:,\d{0,2})?$/.test(withComma)) return;

    const [rawInteger = '', fraction] = withComma.split(',');
    const integer = rawInteger.replace(/^0+(?=\d)/, '') || (rawInteger ? '0' : '');
    const normalized = fraction === undefined
      ? integer
      : `${integer || '0'},${fraction}`;
    if (!normalized) {
      setCommissionInput('');
      setCommissionInputError('');
      updateSelected({ commissionPercentage: 0 });
      return;
    }

    const percentage = parseSpreadsheetCommissionPercentage(normalized);
    if (percentage === null && !normalized.endsWith(',')) {
      setCommissionInputError('Informe um percentual entre 0 e 100, com até duas casas decimais.');
      return;
    }

    if (percentage !== null) {
      setCommissionInputError('');
      updateSelected({ commissionPercentage: percentage });
    } else {
      setCommissionInputError('');
    }
    setCommissionInput(normalized);
  };

  const handleCommissionPercentageBlur = () => {
    const percentage = parseSpreadsheetCommissionPercentage(commissionInput);
    if (percentage === null) {
      const savedValue = selected?.commissionPercentage ?? 0;
      setCommissionInput(String(savedValue).replace('.', ','));
      setCommissionInputError('');
      return;
    }
    updateSelected({ commissionPercentage: percentage });
    setCommissionInput(String(percentage).replace('.', ','));
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


  const handleSetColumnFormula = (column: SpreadsheetColumn) => {
    if (!selected || column.type !== 'currency') return;

    const available = selected.columns.filter(
      (item) =>
        item.type === 'currency' &&
        item.id !== column.id &&
        !item.formulaConfig &&
        !item.formulaExpression &&
        !item.formula
    );

    const current = column.formulaConfig;
    setFormulaModalColumnId(column.id);
    setFormulaMode(current?.mode || 'row');
    setFormulaOperator(current?.operator || '+');
    setFormulaSourceColumnId(
      current?.sourceColumnId && available.some((item) => item.id === current.sourceColumnId)
        ? current.sourceColumnId
        : available[0]?.id || ''
    );
    setFormulaSecondColumnId(
      current?.secondColumnId && available.some((item) => item.id === current.secondColumnId)
        ? current.secondColumnId
        : available.find((item) => item.id !== (current?.sourceColumnId || available[0]?.id))?.id || ''
    );
    setSyncError('');
  };

  const handleSaveColumnFormula = () => {
    if (!selected || !formulaModalColumnId) return;

    const target = selected.columns.find((item) => item.id === formulaModalColumnId);
    const first = selected.columns.find((item) => item.id === formulaSourceColumnId);
    const second = selected.columns.find((item) => item.id === formulaSecondColumnId);

    const isManualCurrency = (column?: SpreadsheetColumn) =>
      !!column &&
      column.type === 'currency' &&
      !column.formulaConfig &&
      !column.formulaExpression &&
      !column.formula;

    if (
      !target ||
      target.type !== 'currency' ||
      !isManualCurrency(first) ||
      !isManualCurrency(second) ||
      first.id === second.id ||
      first.id === target.id ||
      second.id === target.id
    ) {
      setSyncError('Escolha duas colunas monetárias diferentes e válidas para calcular.');
      return;
    }

    updateSelected({
      columns: selected.columns.map((item) =>
        item.id === target.id
          ? {
              ...item,
              formulaConfig: {
                mode: formulaMode,
                sourceColumnId: first.id,
                operator: formulaOperator,
                secondColumnId: second.id,
              },
              formula: null,
              formulaExpression: null,
            }
          : item
      ),
    });
    setFormulaModalColumnId(null);
  };

  const handleRemoveColumnFormula = () => {
    if (!selected || !formulaModalColumnId) return;

    updateSelected({
      columns: selected.columns.map((item) =>
        item.id === formulaModalColumnId
          ? { ...item, formulaConfig: null, formula: null, formulaExpression: null }
          : item
      ),
    });
    setFormulaModalColumnId(null);
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
      columns: selected.columns
        .filter((item) => item.id !== column.id)
        .map((item) =>
          item.formulaConfig &&
          (item.formulaConfig.sourceColumnId === column.id ||
            item.formulaConfig.secondColumnId === column.id)
            ? { ...item, formulaConfig: null, formula: null, formulaExpression: null }
            : item
        ),
      ...(selected.commissionColumnId === column.id
        ? {
            commissionColumnId: selected.columns.find(
              (item) => item.id !== column.id && item.type === 'currency'
            )?.id || null,
            commissionEnabled: selected.columns.some(
              (item) => item.id !== column.id && item.type === 'currency'
            ) && selected.commissionEnabled,
          }
        : {}),
      ...(selected.unitCommissionColumnId === column.id
        ? {
            unitCommissionColumnId: null,
            unitCommissionEnabled: false,
          }
        : {}),
      ...( [selected.extraCommissionOriginalColumnId, selected.extraCommissionSaleColumnId, selected.extraCommissionQuantityColumnId].includes(column.id)
        ? { extraCommissionEnabled: false,
            extraCommissionOriginalColumnId: selected.extraCommissionOriginalColumnId === column.id ? null : selected.extraCommissionOriginalColumnId,
            extraCommissionSaleColumnId: selected.extraCommissionSaleColumnId === column.id ? null : selected.extraCommissionSaleColumnId,
            extraCommissionQuantityColumnId: selected.extraCommissionQuantityColumnId === column.id ? null : selected.extraCommissionQuantityColumnId } : {}),
      rows: selected.rows.map((row) => {
        const cells = { ...row.cells };
        delete cells[column.id];
        return { ...row, cells };
      }),
    });
  };

  const handleExportPdf = async (includedColumnIds: string[]) => {
    if (!selected) return;
    const exportColumns = selected.columns.filter((column) => includedColumnIds.includes(column.id));
    if (!exportColumns.length) {
      setSyncError('Selecione pelo menos uma coluna para exportar.');
      return;
    }
    if (hasInvalidSpreadsheetExtraCommission(selected)) {
      setSyncError('Confira a configuração e os valores da comissão extra antes de exportar o PDF.');
      return;
    }
      if (hasInvalidUnitQuantity(selected)) {
        setSyncError('Corrija as quantidades inválidas antes de exportar o PDF.');
        return;
      }
    if (hasInvalidSpreadsheetCurrency(selected)) {
      setSyncError('Corrija os valores monetários inválidos antes de exportar o PDF.');
      return;
    }
    try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const estimatedLinesPerRow = selected.rows.reduce((maxLines, row) => {
      const rowLines = exportColumns.reduce((rowMax, column) => {
        const raw = row.cells[column.id] || '';
        return Math.max(rowMax, Math.ceil(raw.length / Math.max(12, 30 - exportColumns.length)));
      }, 1);
      return Math.max(maxLines, rowLines);
    }, 1);
    const pageWidth = Math.max(297, Math.min(500, 34 + exportColumns.length * 18));
    const commissionCount = Number(!!selected.commissionEnabled) + Number(!!selected.unitCommissionEnabled) + Number(!!selected.extraCommissionEnabled);
    const notesHeight = selected.notes.trim() ? Math.ceil(selected.notes.length / 120) * 4 + 10 : 0;
    const estimatedTableHeight = selected.rows.length * (6 + estimatedLinesPerRow * 3.2);
    const pageHeight = Math.max(210, 58 + estimatedTableHeight + commissionCount * 15 + notesHeight);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageWidth, pageHeight] });
    const emittedAt = new Date().toLocaleDateString('pt-BR');
    const columnTitles = [...exportColumns.map((column) => column.name), 'Total'];
    const exportRowTotal = (row: SpreadsheetRow) => {
      let total = 0;
      for (const column of exportColumns) {
        if (column.type !== 'currency' || column.formulaConfig?.mode === 'column') continue;
        const value = column.formulaConfig || column.formulaExpression || column.formula
          ? calculateSpreadsheetColumnFormula(selected, column.id, row)
          : parseSpreadsheetCurrency(row.cells[column.id] || '');
        if (value === null || !Number.isFinite(value)) return null;
        total += value;
      }
      return total;
    };
    const exportGrandTotal = exportColumns.reduce((sum, column) =>
      sum + (column.type === 'currency' ? calculateSpreadsheetColumnTotal(selected, column.id) : 0), 0);
    const body = selected.rows.map((row) => [
      ...exportColumns.map((column) => {
        if (column.formulaConfig?.mode === 'column') return '—';
        if (column.formulaConfig || column.formulaExpression || column.formula) {
          const value = calculateSpreadsheetColumnFormula(selected, column.id, row);
          return value === null || !Number.isFinite(value) ? '—' : formatCurrency(value);
        }
        return column.type === 'currency'
          ? formatCurrency(parseSpreadsheetCurrency(row.cells[column.id] || '') || 0)
          : row.cells[column.id] || '';
      }),
      formatSpreadsheetTotal(exportRowTotal(row)),
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

    const pdfColumnTotals = exportColumns.map((column) =>
      column.type !== 'currency'
        ? '—'
        : formatCurrency(calculateSpreadsheetColumnTotal(selected, column.id))
    );

    autoTable(doc, {
      startY: 36,
      head: [columnTitles],
      body,
      foot: [[...pdfColumnTotals, formatSpreadsheetTotal(exportGrandTotal)]],
      showFoot: 'lastPage',
      footStyles: {
        fillColor: [220, 252, 231],
        textColor: [22, 101, 52],
        fontStyle: 'bold',
        lineColor: [134, 239, 172],
        lineWidth: 0.3,
      },
      theme: 'grid',
      margin: { left: 14, right: 14, top: 36, bottom: 14 },
      styles: {
        font: 'helvetica',
        fontSize: Math.max(4, Math.min(7, 8 - exportColumns.length * 0.16 - selected.rows.length * 0.015)),
        cellPadding: Math.max(0.7, Math.min(2, 2.2 - exportColumns.length * 0.035)),
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(
        columnTitles.map((_, index) => [index, { cellWidth: 'wrap' as const }])
      ),
      pageBreak: 'avoid',
      showHead: 'everyPage',
    });

    const tableDocument = doc as JsPDFDocument & {
      lastAutoTable?: { finalY: number }
    };
    const finalY = tableDocument.lastAutoTable?.finalY || 40;
    const actualPageHeight = doc.internal.pageSize.getHeight();
    const actualPageWidth = doc.internal.pageSize.getWidth();

    const commissions: Array<{
      title: string;
      detail: string;
      amount: number;
    }> = [];

    if (selected.commissionEnabled) {
      commissions.push({
        title: 'Comissao percentual',
        detail: `${selected.commissionPercentage ?? 0}% sobre a base selecionada`,
        amount: calculateSpreadsheetCommission(selected),
      });
    }

    if (selected.unitCommissionEnabled) {
      commissions.push({
        title: 'Comissao por unidade',
        detail:
          `${calculateSpreadsheetUnitCommissionQuantity(selected).toLocaleString('pt-BR')} unidades x ` +
          formatCurrency(selected.unitCommissionAmount ?? 0),
        amount: calculateSpreadsheetUnitCommission(selected),
      });
    }

    if (selected.extraCommissionEnabled) {
      commissions.push({
        title: 'Comissao extra',
        detail: selected.extraCommissionMode === 'fixed'
          ? `${formatCurrency(selected.extraCommissionRate ?? 0)} por unidade acima do preco`
          : `${selected.extraCommissionRate ?? 0}% sobre o excedente da venda`,
        amount: calculateSpreadsheetExtraCommission(selected),
      });
    }

    const totalCommissions = commissions.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const summaryHeight =
      18 +
      (commissions.length > 0 ? 11 + commissions.length * 15 + 18 : 0);

    let summaryY = finalY + 9;

    // A página PDF recebe altura dinâmica para manter tabela e resumo em uma única página.

    // Quadro principal: total geral.
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(
      14, summaryY, pageWidth - 28, 18, 2, 2, 'FD'
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    doc.text('TOTAL GERAL', 19, summaryY + 6);

    doc.setFontSize(15);
    doc.text(
      formatSpreadsheetTotal(calculateSpreadsheetTotal(selected)),
      pageWidth - 19,
      summaryY + 12,
      { align: 'right' }
    );

    if (commissions.length > 0) {
      const sectionY = summaryY + 23;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text('COMISSOES CALCULADAS', 16, sectionY);

      commissions.forEach((item, index) => {
        const y = sectionY + 5 + index * 15;

        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(
            14, y, pageWidth - 28, 14, 1.5, 1.5, 'F'
          );
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(31, 41, 55);
        doc.text(item.title, 19, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.detail, 19, y + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(22, 101, 52);
        doc.text(
          formatCurrency(item.amount),
          pageWidth - 19,
          y + 8,
          { align: 'right' }
        );
      });

      const totalY =
        sectionY + 5 + commissions.length * 15 + 2;

      doc.setFillColor(220, 252, 231);
      doc.roundedRect(
        14, totalY, pageWidth - 28, 13, 2, 2, 'F'
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(22, 101, 52);
      doc.text('TOTAL DAS COMISSOES', 19, totalY + 8);
      doc.text(
        formatCurrency(Math.round(totalCommissions * 100) / 100),
        pageWidth - 19,
        totalY + 8,
        { align: 'right' }
      );
    }

      if (selected.notes.trim()) {
      const notes = doc.splitTextToSize(
        `Observações: ${selected.notes}`,
        doc.internal.pageSize.getWidth() - 28
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      let notesY = summaryY + summaryHeight + 4;
      for (const line of notes) {
        doc.text(line, 14, notesY);
        notesY += 4;
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('HomeFin', 14, actualPageHeight - 6);
    doc.text('1/1', actualPageWidth - 14, actualPageHeight - 6, { align: 'right' });

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
      {formulaModalColumnId && selected && (() => {
        const target = selected.columns.find((item) => item.id === formulaModalColumnId);
        const available = selected.columns.filter(
          (item) =>
            item.type === 'currency' &&
            item.id !== formulaModalColumnId &&
            !item.formulaConfig &&
            !item.formulaExpression &&
            !item.formula
        );
        const validSources =
          available.some((item) => item.id === formulaSourceColumnId) &&
          available.some((item) => item.id === formulaSecondColumnId) &&
          formulaSourceColumnId !== formulaSecondColumnId;

        return (
          <div role="dialog" aria-modal="true" aria-labelledby="formula-modal-title" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">Cálculo automático</p>
                  <h2 id="formula-modal-title" className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    Fórmula: {target?.name || 'Coluna'}
                  </h2>
                </div>
                <button type="button" onClick={() => setFormulaModalColumnId(null)} aria-label="Fechar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X size={20} />
                </button>
              </div>

              <label className="mb-4 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Como deseja calcular?
                <select
                  value={formulaMode}
                  onChange={(event) => setFormulaMode(event.target.value as 'row' | 'column')}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="row">Por linha — calcular cada registro</option>
                  <option value="column">Por coluna — calcular os totais acumulados</option>
                </select>
              </label>

              <label className="mb-4 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Primeira coluna
                <select
                  value={formulaSourceColumnId}
                  onChange={(event) => setFormulaSourceColumnId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Selecione uma coluna</option>
                  {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>

              <label className="mb-4 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Operação
                <select
                  value={formulaOperator}
                  onChange={(event) => setFormulaOperator(event.target.value as '+' | '-' | '*' | '/')}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="+">+ Somar</option>
                  <option value="-">− Subtrair</option>
                  <option value="*">× Multiplicar</option>
                  <option value="/">÷ Dividir</option>
                </select>
              </label>

              <label className="mb-4 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Segunda coluna
                <select
                  value={formulaSecondColumnId}
                  onChange={(event) => setFormulaSecondColumnId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Selecione uma coluna</option>
                  {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>

              <div className="mb-5 rounded-xl bg-primary-50 p-3 text-sm leading-6 text-primary-900 dark:bg-primary-950/40 dark:text-primary-200">
                {formulaMode === 'row'
                  ? 'O HomeFin fará a operação entre os dois valores em cada linha. O resultado aparecerá na coluna calculada e entrará no total da linha e no total geral.'
                  : 'O HomeFin somará primeiro cada uma das duas colunas e depois fará a operação entre esses totais. O resultado aparecerá somente no rodapé da coluna calculada.'}
                {formulaOperator === '/' && (
                  <p className="mt-2 font-medium">Se o divisor for zero, o resultado será exibido como traço (—).</p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <div className="flex gap-2">
                  {(target?.formulaConfig || target?.formula || target?.formulaExpression) && (
                    <button type="button" onClick={handleRemoveColumnFormula} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">
                      Remover fórmula
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormulaModalColumnId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleSaveColumnFormula} disabled={!validSources} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Aplicar fórmula
                  </button>
                </div>
              </div>
              {available.length < 2 && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Adicione pelo menos duas colunas do tipo Valor em R$ sem fórmula para configurar este cálculo.</p>
              )}
            </section>
          </div>
        );
      })()}

      {pdfExportModalOpen && selected && (
        <div role="dialog" aria-modal="true" aria-labelledby="pdf-export-title" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="pdf-export-title" className="text-lg font-bold text-gray-900 dark:text-white">Exportar PDF</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Escolha as colunas que deseja incluir. A planilha original não será alterada.</p>
              </div>
              <button type="button" onClick={() => setPdfExportModalOpen(false)} aria-label="Fechar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={20} /></button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPdfSelectedColumnIds(selected.columns.map((column) => column.id))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">Selecionar todas</button>
              <button type="button" onClick={() => setPdfSelectedColumnIds([])} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">Desmarcar todas</button>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              {selected.columns.map((column) => (
                <label key={column.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/60">
                  <input type="checkbox" checked={pdfSelectedColumnIds.includes(column.id)} onChange={(event) => setPdfSelectedColumnIds((current) => event.target.checked ? [...current, column.id] : current.filter((id) => id !== column.id))} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span>{column.name}</span>
                  <span className="ml-auto text-xs text-gray-400">{column.type === 'currency' ? 'Valor (R$)' : 'Texto'}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">O PDF será gerado em uma única página, com orientação e dimensões ajustadas para evitar cortes.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPdfExportModalOpen(false)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Cancelar</button>
              <button type="button" disabled={!pdfSelectedColumnIds.length} onClick={() => { const ids = [...pdfSelectedColumnIds]; setPdfExportModalOpen(false); void handleExportPdf(ids); }} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} /> Gerar PDF</button>
            </div>
          </section>
        </div>
      )}

      {columnModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
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
      {helpOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/40 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-sm font-semibold text-primary-600 dark:text-primary-400">Guia rápido</p>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Como usar as Planilhas</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Um passo a passo simples para organizar e acompanhar seus valores.</p>
              </div>
              <button onClick={() => setHelpOpen(false)} aria-label="Fechar tutorial" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
            <ol className="space-y-3">
              {[
                ['1. Crie uma planilha', 'Clique em “Nova Planilha” e informe um nome para identificar o controle.'],
                ['2. Escolha o período', 'Selecione o mês e o ano de referência nos campos da planilha.'],
                ['3. Organize as colunas', 'Use “Nova coluna” para incluir campos. Escolha Texto para nomes e descrições ou Valor em R$ para valores que entram no total. Clique no nome de uma coluna para renomeá-la.'],
                ['4. Preencha os lançamentos', 'Digite nomes, serviços e valores nas linhas. Os campos em R$ aceitam valores como 125,50.'],
                ['5. Confira o total geral', 'O total soma automaticamente todas as células numéricas das colunas do tipo Valor em R$.'],
                ['6. Configure a comissão', 'Ative o cálculo, escolha uma coluna de valores e digite o percentual. A comissão é calculada separadamente e não é somada ao total geral.'],
                ['7. Reorganize', 'Segure o ícone de alça no cabeçalho para mover uma coluna ou na linha para movê-la. Em celular, mantenha pressionado por um instante antes de arrastar.'],
                ['8. Salve e consulte', 'Clique em “Salvar” depois das alterações. As planilhas salvas ficam no Histórico para consultar e editar depois.'],
                ['9. Exporte em PDF', 'Clique em “Exportar PDF” para baixar uma cópia organizada da planilha e dos totais.'],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    {index === 6 ? <DragHandleIcon /> : index === 8 ? <Download size={18} /> : <Sparkles size={18} />}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <p className="mt-0.5 text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button onClick={() => setHelpOpen(false)} className="mt-5 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white hover:bg-primary-700">
              Entendi
            </button>
          </section>
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
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setHistoryOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><History size={19} /> Histórico</button>
          <button onClick={() => setHelpOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-3 font-semibold text-primary-700 shadow-sm hover:bg-primary-50 dark:border-primary-800 dark:bg-gray-800 dark:text-primary-300 dark:hover:bg-primary-900/20">
            <BookOpen size={19} /> COMO USAR
          </button>
          <button onClick={handleNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-primary-700">
            <FilePlus2 size={19} /> Nova Planilha
          </button>
        </div>
      </header>

      {showExampleNotice && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-200">
          <Sparkles size={19} className="mt-0.5 shrink-0" />
          <span>Você já tem uma planilha de exemplo para conhecer o funcionamento. Ela pode ser editada, personalizada ou excluída quando quiser.</span>
          <button onClick={() => setShowExampleNotice(false)} aria-label="Fechar aviso" className="ml-auto rounded-lg p-1 hover:bg-primary-100 dark:hover:bg-primary-900/40">
            <X size={17} />
          </button>
        </div>
      )}
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

      {historyOpen && <div role="dialog" aria-modal="true" aria-label="Histórico de planilhas" className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Histórico de planilhas</h2>
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
          <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Fechar</button>
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
                    setHistoryOpen(false);
                    setDirty(false);
                    setSavedInCloud(cloudAvailable);
                    setSyncError('');
                  }
                }}
                className={`min-w-0 overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selected?.id === record.id
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-500 dark:bg-blue-950/50 dark:ring-blue-800'
                    : 'border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-blue-50/70 dark:border-gray-700 dark:bg-gray-900/70 dark:hover:border-blue-800 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{record.name || 'Sem nome'}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {monthNames[record.referenceMonth - 1]} {record.referenceYear}
                    </p>
                  </div>
                  <span className="inline-flex max-w-full min-w-0 self-start break-words rounded-lg border border-emerald-200 bg-emerald-100/80 px-3 py-2 text-sm font-bold leading-snug tabular-nums text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 sm:self-auto sm:text-right">
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
      </section></div>}

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
              <button onClick={() => setCommissionSettingsOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"><Settings2 size={16} /> Configurar comissões</button>
              <button
                onClick={handleDuplicate}
                title="Duplicar planilha"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Copy size={16} /> Duplicar
              </button>
              <button
                onClick={() => {
                  setPdfSelectedColumnIds(selected.columns.map((column) => column.id));
                  setPdfExportModalOpen(true);
                }}
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

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-4 shadow-sm dark:border-emerald-900 dark:from-emerald-950/50 dark:to-teal-950/30">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total geral</p>
              <p className="mt-1 max-w-full break-words text-2xl font-extrabold tabular-nums leading-tight text-emerald-800 dark:text-emerald-200">{formatSpreadsheetTotal(calculateSpreadsheetTotal(selected))}</p>
              {selected.commissionEnabled && <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Comissão percentual ({selected.commissionPercentage ?? 0}%): {formatCurrency(calculateSpreadsheetCommission(selected))}</p>}
              {selected.unitCommissionEnabled && <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Comissão por unidade: {formatCurrency(calculateSpreadsheetUnitCommission(selected))}</p>}
              {selected.extraCommissionEnabled && <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Comissão extra: {formatCurrency(calculateSpreadsheetExtraCommission(selected))}</p>}
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

          {commissionSettingsOpen && <div role="dialog" aria-modal="true" aria-label="Configurações de comissão" className="fixed inset-0 z-[106] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-900 dark:text-white">Configurações de comissão</h2><p className="text-sm text-gray-500 dark:text-gray-400">Configure os cálculos sem ocupar espaço na planilha.</p></div><button type="button" onClick={() => setCommissionSettingsOpen(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Fechar</button></div>
          <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/20">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!selected.commissionEnabled}
                onChange={(event) => {
                  const firstCurrencyColumn = selected.columns.find((column) => column.type === 'currency');
                  updateSelected({
                    commissionEnabled: event.target.checked,
                    commissionColumnId: selected.commissionColumnId || firstCurrencyColumn?.id || null,
                  });
                }}
                className="mt-1 h-5 w-5 accent-primary-600"
              />
              <span>
                <span className="block font-semibold text-gray-800 dark:text-gray-100">Calcular comissão percentual</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">O resultado aparece abaixo do total geral e não altera esse total.</span>
              </span>
            </label>
            {selected.commissionEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Coluna de valores usada como base
                  <select
                    value={selected.commissionColumnId || ''}
                    onChange={(event) => updateSelected({ commissionColumnId: event.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value={SPREADSHEET_TOTAL_COMMISSION_BASE}>Valor total geral</option>
                    {selected.columns
                      .filter((column) => column.type === 'currency')
                      .map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Percentual da comissão
                  <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
                    <input
                            type="text"
                            inputMode="decimal"
                            value={commissionInput}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => handleCommissionPercentageChange(event.target.value)}
                            onBlur={handleCommissionPercentageBlur}
                            aria-invalid={!!commissionInputError}
                            aria-describedby={commissionInputError ? 'commission-percentage-error' : undefined}
                            className="w-full rounded-lg bg-transparent px-3 py-2 text-right outline-none dark:text-white"
                          />
                          <span className="px-3 text-gray-500">%</span>
                        </div>
                      </label>
                      {commissionInputError && (
                        <p id="commission-percentage-error" role="alert" className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">
                          {commissionInputError}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">
                  Base da comissão: {formatCurrency(calculateSpreadsheetCommissionBase(selected, selected.commissionColumnId))}.
                  Células vazias e textos são ignorados.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!selected.unitCommissionEnabled}
                onChange={(event) => updateSelected({
                  unitCommissionEnabled: event.target.checked,
                  unitCommissionColumnId: selected.unitCommissionColumnId || selected.columns[0]?.id || null,
                })}
                className="mt-1 h-5 w-5 accent-primary-600"
              />
              <span>
                <span className="block font-semibold text-gray-800 dark:text-gray-100">
                  Calcular comissão por unidade vendida
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Soma as quantidades e multiplica pelo valor da comissão de cada unidade.
                </span>
              </span>
            </label>
            {selected.unitCommissionEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Coluna de quantidade vendida
                  <select
                    value={selected.unitCommissionColumnId || ''}
                    onChange={(event) => updateSelected({ unitCommissionColumnId: event.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Selecione uma coluna</option>
                    {selected.columns.filter((column) => column.type === 'text').map((column) => (
                      <option key={column.id} value={column.id}>{column.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Comissão por unidade (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.unitCommissionAmount ?? 0}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value) && value >= 0) {
                        updateSelected({ unitCommissionAmount: value });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <div className="sm:col-span-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Quantidade total: {calculateSpreadsheetUnitCommissionQuantity(selected).toLocaleString('pt-BR')}
                  {' | '}Comissão total: {formatCurrency(calculateSpreadsheetUnitCommission(selected))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={!!selected.extraCommissionEnabled}
                onChange={(event) => updateSelected({ extraCommissionEnabled: event.target.checked })}
                className="mt-1 h-5 w-5 accent-primary-600" />
              <span>
                <span className="block font-semibold text-gray-800 dark:text-gray-100">Calcular comissão extra sobre venda acima do preço</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Somente quando o preço vendido superar o original. Multiplica pela quantidade vendida e não altera outras comissões.</span>
              </span>
            </label>
            {selected.extraCommissionEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {([
                  ['extraCommissionOriginalColumnId', 'Coluna de preço original'],
                  ['extraCommissionSaleColumnId', 'Coluna de preço vendido'],
                ] as const).map(([field, title]) => (
                  <label key={field} className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}
                    <select value={selected[field] || ''} onChange={e => updateSelected({ [field]: e.target.value || null })}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                      <option value="">Selecione uma coluna</option>
                      {selected.columns.filter(c => c.type === 'currency').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                ))}
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Coluna de quantidade vendida
                  <select value={selected.extraCommissionQuantityColumnId || ''} onChange={e => updateSelected({ extraCommissionQuantityColumnId: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                    <option value="">Selecione uma coluna</option>
                    {selected.columns.filter(c => c.type === 'text').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Modo de comissão extra
                  <select value={selected.extraCommissionMode || 'percentage'} onChange={e => updateSelected({ extraCommissionMode: e.target.value as 'percentage' | 'fixed', extraCommissionRate: 0 })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                    <option value="percentage">Percentual sobre o excedente</option>
                    <option value="fixed">Valor fixo por unidade acima do preço</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{selected.extraCommissionMode === 'fixed' ? 'Valor por unidade (R$)' : 'Percentual do excedente (%)'}
                  <input type="number" min="0" max={selected.extraCommissionMode === 'fixed' ? undefined : 100} step="0.01"
                    value={selected.extraCommissionRate === 0 ? '' : (selected.extraCommissionRate ?? '')}
                    placeholder="0"
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') {
                        updateSelected({ extraCommissionRate: 0 });
                        return;
                      }
                      const value = Number(raw);
                      if (Number.isFinite(value) && value >= 0) {
                        updateSelected({ extraCommissionRate: value });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </label>
                <div className="sm:col-span-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {hasInvalidSpreadsheetExtraCommission(selected)
                    ? 'Selecione colunas diferentes de preço, a quantidade e confira os valores.'
                    : `Total da comissão extra: ${formatCurrency(calculateSpreadsheetExtraCommission(selected))}`}
                </div>
              </div>
            )}
          </section></div></div>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Lançamentos</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Role horizontalmente para ver as colunas. Segure o ícone de alça e arraste para reorganizar.</p>
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

          <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm dark:border-violet-900/70 dark:bg-violet-950/20">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Preenchimento rápido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Preencha os campos e adicione o lançamento depois do último registro.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selected.columns.map((column) => (
                <label key={column.id} className="block min-w-0 text-sm">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                    {column.name}
                    {column.formulaExpression || column.formula ? ' · automático' : ''}
                  </span>
                  {column.formulaExpression || column.formula ? (
                    <div className="rounded-lg border border-primary-200 bg-primary-100/70 px-3 py-2 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
                      Calculado automaticamente
                    </div>
                  ) : (
                    <input
                      value={quickEntry[column.id] || ''}
                      onChange={(event) =>
                        setQuickEntry((current) => ({
                          ...current,
                          [column.id]: event.target.value,
                        }))
                      }
                      maxLength={2000}
                      inputMode={column.type === 'currency' ? 'decimal' : 'text'}
                      placeholder={column.type === 'currency' ? '0,00' : `Digite ${column.name.toLocaleLowerCase('pt-BR')}`}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 outline-none focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  )}
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddQuickEntry}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <Plus size={16} /> Adicionar lançamento
            </button>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-md">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={rowSearch}
                onChange={(event) => setRowSearch(event.target.value)}
                placeholder="Pesquisar nesta planilha por nome, data ou valor..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-10 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              {rowSearch && (
                <button
                  type="button"
                  onClick={() => setRowSearch('')}
                  aria-label="Limpar pesquisa dos lançamentos"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {filteredRows.length} de {selected.rows.length} lançamento(s)
            </p>
          </div>

          <div className="max-h-[70vh] max-w-full overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900">
                <tr>
                  <th className="w-12 border-b border-r border-gray-200 px-3 py-3 text-center font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">#</th>
                  {selected.columns.map((column) => (
                    <th
                      key={column.id}
                      data-column-id={column.id}
                      className={`min-w-[170px] border-b border-r border-gray-200 px-3 py-2 text-left transition dark:border-gray-700 ${
                        dragging?.kind === 'column' && dragging.sourceId === column.id
                          ? 'relative z-20 scale-[1.02] bg-primary-100 opacity-90 shadow-lg ring-2 ring-inset ring-primary-500 dark:bg-primary-900/70'
                          : ''
                      } ${
                        dragging?.kind === 'column' && dragging.targetId === column.id
                          ? dragging.before ? 'border-l-4 border-l-primary-500 shadow-[inset_4px_0_0_0_rgba(99,102,241,0.9)]' : 'border-r-4 border-r-primary-500 shadow-[inset_-4px_0_0_0_rgba(99,102,241,0.9)]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Segure para mover a coluna ${column.name}`}
                            title="Segure e arraste para reorganizar"
                            onPointerDown={(event) => handleDragPointerDown('column', column.id, event)}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerCancel}
                            onContextMenu={(event) => event.preventDefault()}
                            className="flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-xl text-gray-500 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 dark:text-gray-300 dark:hover:bg-gray-700"
                            style={{ touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none', cursor: 'grab' }}
                          >
                            <DragHandleIcon />
                          </button>
                          <div className="flex items-center gap-0.5"><button type="button" disabled={selected.columns[0]?.id === column.id} onClick={() => moveColumnBy(column.id, -1)} title="Mover coluna para esquerda" className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-25 dark:hover:bg-gray-700"><ChevronLeft size={15} /></button><button type="button" disabled={selected.columns[selected.columns.length - 1]?.id === column.id} onClick={() => moveColumnBy(column.id, 1)} title="Mover coluna para direita" className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-25 dark:hover:bg-gray-700"><ChevronRight size={15} /></button>
                          <button onClick={() => handleRenameColumn(column)} className="truncate font-semibold text-gray-700 hover:text-primary-600 dark:text-gray-200">
                            {column.name}
                          </button></div>
                        </div>
                        {column.type === 'currency' && (
                          <button
                            type="button"
                            onClick={() => handleSetColumnFormula(column)}
                            title={column.formulaConfig || column.formulaExpression || column.formula ? 'Editar fórmula' : 'Definir fórmula'}
                            aria-label={`Definir fórmula para ${column.name}`}
                            className="rounded p-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-700"
                          >
                            ƒx
                          </button>
                        )}
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
                {filteredRows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    className={`odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/60 transition ${
                      dragging?.kind === 'row' && dragging.sourceId === row.id
                        ? 'relative z-20 bg-primary-100 opacity-90 shadow-lg ring-2 ring-inset ring-primary-500 dark:bg-primary-900/70'
                        : ''
                    } ${
                      dragging?.kind === 'row' && dragging.targetId === row.id
                        ? dragging.before
                          ? 'border-t-4 border-t-primary-500 shadow-[inset_0_4px_0_0_rgba(99,102,241,0.9)]'
                          : 'border-b-4 border-b-primary-500 shadow-[inset_0_-4px_0_0_rgba(99,102,241,0.9)]'
                        : ''
                    }`}
                  >
                    <td className="border-r border-b border-gray-200 px-2 py-2 text-center text-gray-400 dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          aria-label={`Segure para mover a linha ${rowIndex + 1}`}
                          title="Segure e arraste para reorganizar"
                          onPointerDown={(event) => handleDragPointerDown('row', row.id, event)}
                          onPointerMove={handleDragPointerMove}
                          onPointerUp={handleDragPointerUp}
                          onPointerCancel={handleDragPointerCancel}
                          onContextMenu={(event) => event.preventDefault()}
                          className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-xl text-gray-500 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 dark:text-gray-300 dark:hover:bg-gray-700"
                          style={{ touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none', cursor: 'grab' }}
                        >
                          <DragHandleIcon />
                        </button>
                        <button type="button" disabled={rowIndex === 0} onClick={() => moveRowBy(row.id, -1)} title="Mover linha para cima" className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-25 dark:hover:bg-gray-700"><ChevronUp size={15} /></button><button type="button" disabled={rowIndex === selected.rows.length - 1} onClick={() => moveRowBy(row.id, 1)} title="Mover linha para baixo" className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-25 dark:hover:bg-gray-700"><ChevronDown size={15} /></button>
                        {rowIndex + 1}
                      </div>
                    </td>
                    {selected.columns.map((column) => (
                      <td key={column.id} className="border-r border-b border-gray-200 p-1.5 dark:border-gray-700">
                        {column.formulaConfig?.mode === 'column' ? (
                          <div className="rounded-md bg-gray-100 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                            No total da coluna
                          </div>
                        ) : (column.formulaConfig || column.formulaExpression || column.formula) ? (
                          <div className="rounded-md border border-primary-200 bg-primary-50 px-2 py-2 text-right font-semibold text-primary-800 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-200">
                            {(() => {
                              const value = calculateSpreadsheetColumnFormula(selected, column.id, row);
                              return value === null || !Number.isFinite(value) ? '—' : formatCurrency(value);
                            })()}
                          </div>
                        ) : column.type === 'currency' ? (
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
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={selected.columns.length + 3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {selected.rows.length
                        ? 'Nenhum lançamento encontrado para esta pesquisa.'
                        : 'Nenhuma linha. Use “Nova linha” ou o preenchimento rápido para adicionar um lançamento.'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold dark:bg-gray-900/70">
                  <td className="border-t border-gray-200 px-3 py-3 text-right text-gray-700 dark:border-gray-700 dark:text-gray-200">Total por coluna</td>
                  {selected.columns.map((column) => {
                    if (column.type !== 'currency') {
                      return <td key={column.id} className="border-t border-gray-200 px-3 py-3 text-right text-gray-400 dark:border-gray-700">—</td>;
                    }
                    const total = calculateSpreadsheetColumnTotal(selected, column.id);
                    return <td key={column.id} className="border-t border-gray-200 px-3 py-3 text-right text-gray-800 dark:border-gray-700 dark:text-gray-100">{formatCurrency(total)}</td>;
                  })}
                  <td className="border-t border-gray-200 px-3 py-3 text-right">—</td>
                  <td className="border-t border-gray-200 dark:border-gray-700" />
                </tr>
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
