import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AddedItem,
  HomefinFamilyIdentity,
  Product,
  StockMovement,
  StockWorkspace,
  StockType,
} from '../types';
import { INITIAL_PRODUCTS } from '../data/seedProducts';

const LEGACY_KEYS = {
  PRODUCTS: 'mentora_estoque_products_v1',
  ADDED_ITEMS: 'mentora_estoque_added_items_v1',
  HISTORY: 'mentora_estoque_history_v1',
};

const KEYS = {
  WORKSPACES: 'homefin_estoques_workspaces_v1',
  ACTIVE_ESTOQUE_ID: 'homefin_active_estoque_id_v1',
  ACTIVE_FAMILY: 'homefin_active_family_v1',
  products: (estoqueId: string) => `homefin_estoque_products_${estoqueId}`,
  addedItems: (estoqueId: string) => `homefin_estoque_added_${estoqueId}`,
  history: (estoqueId: string) => `homefin_estoque_history_${estoqueId}`,
};

export const DEFAULT_FAMILIES: HomefinFamilyIdentity[] = [
  {
    userId: 'usr-principal',
    familyId: 'fam-principal',
    familyName: 'Minha Família HOMEFIN',
  },
  {
    userId: 'usr-parceira',
    familyId: 'fam-parceira',
    familyName: 'Outra Família HOMEFIN (Parceira)',
  },
];

export const DEFAULT_SHARED_ESTOQUE_ID = 'est-compartilhado-1';
export const DEFAULT_PRIVATE_ESTOQUE_ID = 'est-privado-1';

export function generateShareCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l1 = letters[Math.floor(Math.random() * letters.length)];
  const l2 = letters[Math.floor(Math.random() * letters.length)];
  return `HF-${l1}${l2}-${num}`;
}

function getDefaultPrivateSeedProducts(estoqueId: string): Product[] {
  const base1 = INITIAL_PRODUCTS[0];
  const base2 = INITIAL_PRODUCTS[4] || INITIAL_PRODUCTS[1];
  return [
    {
      ...base1,
      id: `priv-prod-1`,
      estoqueId,
      codigoInterno: '901',
      codigoBarras: '7899001009011',
      descricao: 'PNEU RESERVA PARTICULAR 195/55R15 (ESTOQUE SEPARADO)',
      estoqueAtual: 4,
      vendaMediaMensal: 2,
      estoqueMinimo: 2,
      observacao: 'Item exclusivo do meu estoque pessoal separado (não compartilhado).',
      favorito: true,
    },
    {
      ...base2,
      id: `priv-prod-2`,
      estoqueId,
      codigoInterno: '902',
      codigoBarras: '7899001009028',
      descricao: 'LUBRIFICANTE & REVISÃO PARTICULAR 20W50',
      estoqueAtual: 6,
      vendaMediaMensal: 3,
      estoqueMinimo: 2,
      observacao: 'Uso exclusivo sem compartilhamento com outra família.',
      favorito: false,
    },
  ];
}

function getDefaultAddedItems(estoqueId: string): AddedItem[] {
  const lanvigator =
    INITIAL_PRODUCTS.find((p) => p.codigoInterno === '798') || INITIAL_PRODUCTS[1];
  if (!lanvigator) return [];
  return [
    {
      id: `added-${estoqueId}-1`,
      estoqueId,
      productId: lanvigator.id,
      codigoInterno: lanvigator.codigoInterno,
      codigoBarras: lanvigator.codigoBarras,
      descricao: lanvigator.descricao,
      medida: lanvigator.medida,
      marcaRefer: lanvigator.marcaRefer,
      unidade: lanvigator.unidade,
      estoqueAtual: lanvigator.estoqueAtual,
      qtdAdicionado: 1,
      tipoPreco: 'varejo',
      precoUnitario: lanvigator.precoVarejo,
      desconto: 0,
      tipoDesconto: 'valor',
      valorTotal: lanvigator.precoVarejo,
      fotoUrl: lanvigator.fotoUrl,
    },
  ];
}

/**
 * Inicializa e migra dados locais caso seja a primeira execução do módulo multi-estoque HOMEFIN.
 */
export function loadOrInitializeLocalWorkspaces(
  primaryFamily: HomefinFamilyIdentity
): StockWorkspace[] {
  try {
    const raw = localStorage.getItem(KEYS.WORKSPACES);
    if (raw) {
      const parsed = JSON.parse(raw) as StockWorkspace[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback para seed
  }

  // Migrar catálogo antigo se existir
  let migratedProducts = INITIAL_PRODUCTS.map((p) => ({
    ...p,
    estoqueId: DEFAULT_SHARED_ESTOQUE_ID,
  }));
  let migratedAdded = getDefaultAddedItems(DEFAULT_SHARED_ESTOQUE_ID);
  let migratedHistory: StockMovement[] = [];

  try {
    const oldProds = localStorage.getItem(LEGACY_KEYS.PRODUCTS);
    if (oldProds) {
      const parsed = JSON.parse(oldProds) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        migratedProducts = parsed.map((p) => ({ ...p, estoqueId: DEFAULT_SHARED_ESTOQUE_ID }));
      }
    }
    const oldAdded = localStorage.getItem(LEGACY_KEYS.ADDED_ITEMS);
    if (oldAdded) {
      const parsed = JSON.parse(oldAdded) as AddedItem[];
      if (Array.isArray(parsed)) {
        migratedAdded = parsed.map((a) => ({ ...a, estoqueId: DEFAULT_SHARED_ESTOQUE_ID }));
      }
    }
    const oldHist = localStorage.getItem(LEGACY_KEYS.HISTORY);
    if (oldHist) {
      const parsed = JSON.parse(oldHist) as StockMovement[];
      if (Array.isArray(parsed)) {
        migratedHistory = parsed.map((h) => ({ ...h, estoqueId: DEFAULT_SHARED_ESTOQUE_ID }));
      }
    }
  } catch {
    // ignore migration parse error
  }

  const now = new Date().toISOString();
  const partnerFamily = DEFAULT_FAMILIES[1];

  const initialWorkspaces: StockWorkspace[] = [
    {
      id: DEFAULT_SHARED_ESTOQUE_ID,
      nome: 'Estoque Compartilhado (Famílias)',
      tipo: 'compartilhado',
      ownerFamilyId: primaryFamily.familyId,
      ownerFamilyName: primaryFamily.familyName,
      codigoCompartilhamento: 'HF-FAM-4821',
      membros: [
        {
          familyId: primaryFamily.familyId,
          familyName: primaryFamily.familyName,
          role: 'dono',
          joinedAt: now,
        },
        {
          familyId: partnerFamily.familyId,
          familyName: partnerFamily.familyName,
          role: 'editor',
          joinedAt: now,
        },
      ],
      createdAt: now,
    },
    {
      id: DEFAULT_PRIVATE_ESTOQUE_ID,
      nome: 'Meu Estoque Separado (Privado)',
      tipo: 'privado',
      ownerFamilyId: primaryFamily.familyId,
      ownerFamilyName: primaryFamily.familyName,
      membros: [
        {
          familyId: primaryFamily.familyId,
          familyName: primaryFamily.familyName,
          role: 'dono',
          joinedAt: now,
        },
      ],
      createdAt: now,
    },
  ];

  saveLocalWorkspaces(initialWorkspaces);
  saveLocalProducts(DEFAULT_SHARED_ESTOQUE_ID, migratedProducts);
  saveLocalAddedItems(DEFAULT_SHARED_ESTOQUE_ID, migratedAdded);
  saveLocalHistory(DEFAULT_SHARED_ESTOQUE_ID, migratedHistory);

  saveLocalProducts(
    DEFAULT_PRIVATE_ESTOQUE_ID,
    getDefaultPrivateSeedProducts(DEFAULT_PRIVATE_ESTOQUE_ID)
  );
  saveLocalAddedItems(DEFAULT_PRIVATE_ESTOQUE_ID, []);
  saveLocalHistory(DEFAULT_PRIVATE_ESTOQUE_ID, []);

  return initialWorkspaces;
}

export function getVisibleWorkspacesForFamily(
  allWorkspaces: StockWorkspace[],
  familyId: string
): StockWorkspace[] {
  return allWorkspaces.filter((w) => {
    if (w.ownerFamilyId === familyId) return true;
    if (w.tipo === 'compartilhado') {
      return w.membros.some((m) => m.familyId === familyId);
    }
    return false;
  });
}

export function saveLocalWorkspaces(workspaces: StockWorkspace[]): void {
  try {
    localStorage.setItem(KEYS.WORKSPACES, JSON.stringify(workspaces));
  } catch {
    // ignore quota error
  }
}

export function loadLocalActiveFamily(fallback?: HomefinFamilyIdentity): HomefinFamilyIdentity {
  if (fallback) return fallback;
  try {
    const raw = localStorage.getItem(KEYS.ACTIVE_FAMILY);
    if (raw) return JSON.parse(raw) as HomefinFamilyIdentity;
  } catch {
    // fallback
  }
  return DEFAULT_FAMILIES[0];
}

export function saveLocalActiveFamily(family: HomefinFamilyIdentity): void {
  try {
    localStorage.setItem(KEYS.ACTIVE_FAMILY, JSON.stringify(family));
  } catch {
    // ignore
  }
}

export function loadLocalActiveEstoqueId(): string | null {
  try {
    return localStorage.getItem(KEYS.ACTIVE_ESTOQUE_ID);
  } catch {
    return null;
  }
}

export function saveLocalActiveEstoqueId(estoqueId: string): void {
  try {
    localStorage.setItem(KEYS.ACTIVE_ESTOQUE_ID, estoqueId);
  } catch {
    // ignore
  }
}

export function loadLocalProducts(estoqueId: string): Product[] {
  try {
    const raw = localStorage.getItem(KEYS.products(estoqueId));
    if (raw) return JSON.parse(raw) as Product[];
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalProducts(estoqueId: string, products: Product[]): void {
  try {
    localStorage.setItem(KEYS.products(estoqueId), JSON.stringify(products));
  } catch {
    // ignore
  }
}

export function loadLocalAddedItems(estoqueId: string): AddedItem[] {
  try {
    const raw = localStorage.getItem(KEYS.addedItems(estoqueId));
    if (raw) return JSON.parse(raw) as AddedItem[];
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalAddedItems(estoqueId: string, items: AddedItem[]): void {
  try {
    localStorage.setItem(KEYS.addedItems(estoqueId), JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadLocalHistory(estoqueId: string): StockMovement[] {
  try {
    const raw = localStorage.getItem(KEYS.history(estoqueId));
    if (raw) return JSON.parse(raw) as StockMovement[];
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalHistory(estoqueId: string, history: StockMovement[]): void {
  try {
    localStorage.setItem(KEYS.history(estoqueId), JSON.stringify(history));
  } catch {
    // ignore
  }
}

// ============================================================================
// FUNÇÕES DE SINCRONIZAÇÃO SUPABASE (INTEGRAÇÃO REAL COM HOMEFIN)
// ============================================================================

interface SupabaseEstoqueRow {
  id: string;
  nome: string;
  tipo: StockType;
  owner_family_id: string;
  owner_family_name: string;
  codigo_compartilhamento: string | null;
  created_at: string;
  homefin_estoque_membros?: Array<{
    family_id: string;
    family_name: string;
    role: 'dono' | 'editor';
    joined_at: string;
  }>;
}

interface SupabaseProductRow {
  id: string;
  estoque_id: string;
  codigo_interno: string;
  codigo_barras: string;
  descricao: string;
  medida: string;
  unidade: string;
  marca_refer: string;
  estoque_atual: number;
  preco_varejo: number;
  preco_atacado: number;
  valor_prom: number;
  ncm: string;
  peso_bruto: number;
  peso_liquido: number;
  observacao: string;
  foto_url: string;
  favorito: boolean;
  venda_media_mensal: number;
  estoque_minimo: number;
}

interface SupabaseMovementRow {
  id: string;
  estoque_id: string;
  timestamp_label: string;
  product_id: string;
  codigo_interno: string;
  descricao: string;
  tipo: 'baixa' | 'entrada';
  quantidade: number;
  estoque_anterior: number;
  estoque_novo: number;
  motivo: string | null;
  familia_nome: string | null;
}

export function mapRowToProduct(row: SupabaseProductRow): Product {
  return {
    id: row.id,
    estoqueId: row.estoque_id,
    codigoInterno: row.codigo_interno,
    codigoBarras: row.codigo_barras || '',
    descricao: row.descricao,
    medida: row.medida || '',
    unidade: row.unidade || 'UN',
    marcaRefer: row.marca_refer || '',
    estoqueAtual: Number(row.estoque_atual) || 0,
    precoVarejo: Number(row.preco_varejo) || 0,
    precoAtacado: Number(row.preco_atacado) || 0,
    valorProm: Number(row.valor_prom) || 0,
    ncm: row.ncm || '00000000',
    pesoBruto: Number(row.peso_bruto) || 0,
    pesoLiquido: Number(row.peso_liquido) || 0,
    observacao: row.observacao || '',
    fotoUrl: row.foto_url || '',
    favorito: Boolean(row.favorito),
    vendaMediaMensal: Number(row.venda_media_mensal) || 0,
    estoqueMinimo: Number(row.estoque_minimo) || 0,
  };
}

export function mapProductToRow(estoqueId: string, p: Product): SupabaseProductRow {
  return {
    id: p.id,
    estoque_id: estoqueId,
    codigo_interno: p.codigoInterno,
    codigo_barras: p.codigoBarras || '',
    descricao: p.descricao,
    medida: p.medida || '',
    unidade: p.unidade || 'UN',
    marca_refer: p.marcaRefer || '',
    estoque_atual: p.estoqueAtual,
    preco_varejo: p.precoVarejo,
    preco_atacado: p.precoAtacado,
    valor_prom: p.valorProm || 0,
    ncm: p.ncm || '00000000',
    peso_bruto: p.pesoBruto || 0,
    peso_liquido: p.pesoLiquido || 0,
    observacao: p.observacao || '',
    foto_url: p.fotoUrl || '',
    favorito: Boolean(p.favorito),
    venda_media_mensal: p.vendaMediaMensal || 0,
    estoque_minimo: p.estoqueMinimo || 0,
  };
}

export async function fetchSupabaseWorkspaces(
  supabase: SupabaseClient
): Promise<StockWorkspace[]> {
  const { data, error } = await supabase
    .from('homefin_estoques')
    .select(
      'id, nome, tipo, owner_family_id, owner_family_name, codigo_compartilhamento, created_at, homefin_estoque_membros(family_id, family_name, role, joined_at)'
    )
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data || []) as SupabaseEstoqueRow[]).map((row) => ({
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    ownerFamilyId: row.owner_family_id,
    ownerFamilyName: row.owner_family_name,
    codigoCompartilhamento: row.codigo_compartilhamento || undefined,
    membros: (row.homefin_estoque_membros || []).map((m) => ({
      familyId: m.family_id,
      familyName: m.family_name,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    createdAt: row.created_at,
  }));
}

export async function createSupabaseWorkspace(
  supabase: SupabaseClient,
  params: {
    nome: string;
    tipo: StockType;
    family: HomefinFamilyIdentity;
    codigoCompartilhamento?: string;
    seedInitialProducts?: boolean;
  }
): Promise<StockWorkspace> {
  const { nome, tipo, family, codigoCompartilhamento, seedInitialProducts } = params;
  const code = tipo === 'compartilhado' ? codigoCompartilhamento || generateShareCode() : null;

  const { data: created, error } = await supabase
    .from('homefin_estoques')
    .insert({
      nome,
      tipo,
      owner_user_id: family.userId,
      owner_family_id: family.familyId,
      owner_family_name: family.familyName,
      codigo_compartilhamento: code,
    })
    .select()
    .single();

  if (error || !created) throw error || new Error('Erro ao criar estoque no Supabase');

  await supabase.from('homefin_estoque_membros').insert({
    estoque_id: created.id,
    family_id: family.familyId,
    family_name: family.familyName,
    user_id: family.userId,
    role: 'dono',
  });

  if (seedInitialProducts) {
    const rows = INITIAL_PRODUCTS.map((p) =>
      mapProductToRow(created.id, { ...p, id: `${created.id}-${p.id}` })
    );
    await supabase.from('homefin_estoque_produtos').insert(rows);
  }

  return {
    id: created.id,
    nome: created.nome,
    tipo: created.tipo,
    ownerFamilyId: created.owner_family_id,
    ownerFamilyName: created.owner_family_name,
    codigoCompartilhamento: created.codigo_compartilhamento || undefined,
    membros: [
      {
        familyId: family.familyId,
        familyName: family.familyName,
        role: 'dono',
        joinedAt: created.created_at,
      },
    ],
    createdAt: created.created_at,
  };
}

export async function joinSupabaseWorkspaceByCode(
  supabase: SupabaseClient,
  codigo: string,
  family: HomefinFamilyIdentity
): Promise<StockWorkspace> {
  const { data, error } = await supabase.rpc('entrar_estoque_por_codigo', {
    p_codigo: codigo.trim().toUpperCase(),
    p_family_id: family.familyId,
    p_family_name: family.familyName,
  });

  if (error || !data) {
    throw error || new Error('Código não encontrado ou estoque privado.');
  }

  const all = await fetchSupabaseWorkspaces(supabase);
  const found = all.find((w) => w.id === data.id);
  if (!found) {
    throw new Error('Estoque vinculado, mas não foi possível carregá-lo.');
  }
  return found;
}

export async function fetchSupabaseProducts(
  supabase: SupabaseClient,
  estoqueId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('homefin_estoque_produtos')
    .select('*')
    .eq('estoque_id', estoqueId)
    .order('descricao', { ascending: true });

  if (error) throw error;
  return ((data || []) as SupabaseProductRow[]).map(mapRowToProduct);
}

export async function upsertSupabaseProducts(
  supabase: SupabaseClient,
  estoqueId: string,
  products: Product[]
): Promise<void> {
  if (products.length === 0) return;
  const rows = products.map((p) => mapProductToRow(estoqueId, p));
  const { error } = await supabase
    .from('homefin_estoque_produtos')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchSupabaseMovements(
  supabase: SupabaseClient,
  estoqueId: string
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('homefin_estoque_movimentacoes')
    .select('*')
    .eq('estoque_id', estoqueId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return ((data || []) as SupabaseMovementRow[]).map((r) => ({
    id: r.id,
    estoqueId: r.estoque_id,
    timestamp: r.timestamp_label,
    productId: r.product_id,
    codigoInterno: r.codigo_interno,
    descricao: r.descricao,
    tipo: r.tipo,
    quantidade: Number(r.quantidade),
    estoqueAnterior: Number(r.estoque_anterior),
    estoqueNovo: Number(r.estoque_novo),
    motivo: r.motivo || undefined,
    familiaNome: r.familia_nome || undefined,
  }));
}

export async function insertSupabaseMovements(
  supabase: SupabaseClient,
  estoqueId: string,
  movements: StockMovement[]
): Promise<void> {
  if (movements.length === 0) return;
  const rows = movements.map((m) => ({
    id: m.id,
    estoque_id: estoqueId,
    timestamp_label: m.timestamp,
    product_id: m.productId,
    codigo_interno: m.codigoInterno,
    descricao: m.descricao,
    tipo: m.tipo,
    quantidade: m.quantidade,
    estoque_anterior: m.estoqueAnterior,
    estoque_novo: m.estoqueNovo,
    motivo: m.motivo || null,
    familia_nome: m.familiaNome || null,
  }));
  const { error } = await supabase
    .from('homefin_estoque_movimentacoes')
    .insert(rows);
  if (error) throw error;
}
