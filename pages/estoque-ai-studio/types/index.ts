import type { SupabaseClient } from '@supabase/supabase-js';

export interface Product {
  id: string;
  estoqueId?: string;
  codigoInterno: string;
  codigoBarras: string;
  descricao: string;
  medida: string;
  unidade: string;
  marcaRefer: string;
  estoqueAtual: number;
  precoVarejo: number;
  precoAtacado: number;
  valorProm: number;
  ncm: string;
  pesoBruto: number;
  pesoLiquido: number;
  observacao: string;
  fotoUrl: string;
  favorito?: boolean;
  vendaMediaMensal?: number; // Média de vendas/saídas por mês (ex: 10/mês)
  estoqueMinimo?: number;    // Ponto de reposição
}

export interface AddedItem {
  id: string;
  estoqueId?: string;
  productId: string;
  codigoInterno: string;
  codigoBarras: string;
  descricao: string;
  medida: string;
  marcaRefer: string;
  unidade: string;
  estoqueAtual: number;
  qtdAdicionado: number;
  tipoPreco: 'varejo' | 'atacado';
  precoUnitario: number;
  desconto: number;
  tipoDesconto: 'valor' | 'porcentagem';
  valorTotal: number;
  fotoUrl: string;
  observacao?: string;
}

export interface StockMovement {
  id: string;
  estoqueId?: string;
  timestamp: string;
  productId: string;
  codigoInterno: string;
  descricao: string;
  tipo: 'baixa' | 'entrada';
  quantidade: number;
  estoqueAnterior: number;
  estoqueNovo: number;
  motivo?: string;
  familiaNome?: string; // Identifica qual família HOMEFIN fez a movimentação
}

export interface StockFamilyMember {
  familyId: string;
  familyName: string;
  role: 'dono' | 'editor';
  joinedAt: string;
}

export type StockType = 'compartilhado' | 'privado';

export interface StockWorkspace {
  id: string;
  nome: string;
  tipo: StockType;
  ownerFamilyId: string;
  ownerFamilyName: string;
  codigoCompartilhamento?: string;
  membros: StockFamilyMember[];
  createdAt: string;
}

export interface HomefinFamilyIdentity {
  userId: string;
  familyId: string;
  familyName: string;
}

export interface EstoqueHomefinPageProps {
  /** Cliente Supabase já autenticado do sistema HOMEFIN (opcional; se omitido usa VITE_SUPABASE_URL/ANON_KEY ou modo local) */
  supabaseClient?: SupabaseClient | null;
  /** ID do usuário autenticado no HOMEFIN */
  homefinUserId?: string;
  /** ID da família ativa do usuário no HOMEFIN */
  homefinFamilyId?: string;
  /** Nome da família ativa no HOMEFIN */
  homefinFamilyName?: string;
}
