import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppData } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('=== SUPABASE DEBUG ===');
console.log('URL:', SUPABASE_URL);
console.log(
  'KEY:',
  SUPABASE_ANON_KEY
    ? `${SUPABASE_ANON_KEY.substring(0, 20)}...`
    : 'NÃO CONFIGURADA'
);

// ============================================================
// SUPABASE CLIENT
// ============================================================

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ============================================================
// TIPOS
// ============================================================

export interface HomeFinDataRow {
  family_id: string;
  data: AppData;
  updated_at: string;
}

export interface HomeFinSaasRow {
  id: string;
  data: any;
  updated_at: string;
}

// ============================================================
// VALIDAÇÃO
// ============================================================

function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    );
  }

  return supabase;
}

// ============================================================
// HOMEFIN SERVICE
// ============================================================

export const supabaseService = {

  // ==========================================================
  // DADOS FINANCEIROS DAS FAMÍLIAS
  // ==========================================================

  /**
   * Busca todos os dados de uma família.
   */
    getFamilyData: async (familyId: string): Promise<AppData | null> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `homefin_data?select=data&family_id=eq.${encodeURIComponent(familyId)}`,
        method: 'GET',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao buscar dados da família:', data);
      throw new Error(data?.error || data?.message || 'Erro ao buscar dados da família.');
    }

    return data?.[0]?.data ?? null;
  },

  saveFamilyData: async (
    familyId: string,
    appData: AppData
  ): Promise<HomeFinDataRow> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: 'homefin_data?on_conflict=family_id',
        method: 'POST',
        body: {
          family_id: familyId,
          data: appData,
          updated_at: new Date().toISOString(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao salvar dados da família:', data);
      throw new Error(data?.error || data?.message || 'Erro ao salvar dados da família.');
    }

    return data?.[0] as HomeFinDataRow;
  },

  createFamilyData: async (
    familyId: string,
    appData: AppData
  ): Promise<HomeFinDataRow> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: 'homefin_data',
        method: 'POST',
        body: {
          family_id: familyId,
          data: appData,
          updated_at: new Date().toISOString(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao criar dados da família:', data);
      throw new Error(data?.error || data?.message || 'Erro ao criar dados da família.');
    }

    return data?.[0] as HomeFinDataRow;
  },

  familyExists: async (familyId: string): Promise<boolean> => {
    if (!familyId) {
      return false;
    }

    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `homefin_data?select=family_id&family_id=eq.${encodeURIComponent(familyId)}`,
        method: 'GET',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao verificar família:', data);
      throw new Error(data?.error || data?.message || 'Erro ao verificar família.');
    }

    return Array.isArray(data) && data.length > 0;
  },

  deleteFamilyData: async (familyId: string): Promise<void> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `homefin_data?family_id=eq.${encodeURIComponent(familyId)}`,
        method: 'DELETE',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao excluir dados da família:', data);
      throw new Error(data?.error || data?.message || 'Erro ao excluir dados da família.');
    }
  },

  getLastUpdate: async (familyId: string): Promise<string | null> => {
    if (!familyId) {
      return null;
    }

    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `homefin_data?select=updated_at&family_id=eq.${encodeURIComponent(familyId)}`,
        method: 'GET',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao buscar última atualização:', data);
      throw new Error(data?.error || data?.message || 'Erro ao buscar última atualização.');
    }

    return data?.[0]?.updated_at ?? null;
  },

  // ==========================================================
  // DADOS SaaS GLOBAIS
  // ==========================================================

  /**
   * Busca a configuração global do HomeFin.
   *
   * Essa tabela guarda:
   * - famílias
   * - planos
   * - códigos
   * - landing page
   * - configuração de pagamento
   * - configuração de administrador
   * - banner
   */
    getSaasData: async (): Promise<any | null> => {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: 'homefin_saas?select=data&id=eq.global',
        method: 'GET',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao buscar dados SaaS:', data);
      throw new Error(
        data?.error ||
        data?.message ||
        'Erro ao buscar dados SaaS.'
      );
    }

    return data?.[0]?.data ?? null;
  },

  /**
   * Salva ou atualiza toda a configuração SaaS.
   *
   * Usa uma única linha com id = "global".
   */
  saveSaasData: async (saasData: any): Promise<HomeFinSaasRow> => {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: 'homefin_saas?on_conflict=id',
        method: 'POST',
        body: {
          id: 'global',
          data: saasData,
          updated_at: new Date().toISOString(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao salvar dados SaaS:', data);
      throw new Error(
        data?.error ||
        data?.message ||
        'Erro ao salvar dados SaaS.'
      );
    }

    return data?.[0] as HomeFinSaasRow;
  },


  // ==========================================================
  // STORAGE / ANEXOS
  // ==========================================================

  /**
   * Upload de anexos para o Storage.
   */
  uploadAttachment: async (
    file: File,
    familyId?: string
  ) => {
    const client = getSupabase();

    if (!file) {
      throw new Error('Arquivo não informado.');
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    const fileName = familyId
      ? `${familyId}/${Date.now()}_${safeFileName}`
      : `${Date.now()}_${safeFileName}`;

    const { data, error } = await client.storage
      .from('attachments')
      .upload(fileName, file, {
        upsert: false,
      });

    if (error) {
      console.error('Erro ao enviar anexo:', error);
      throw error;
    }

    return data;
  },

  /**
   * Remove um anexo do Storage.
   */
  deleteAttachment: async (filePath: string): Promise<void> => {
    const client = getSupabase();

    if (!filePath) {
      throw new Error('Caminho do arquivo não informado.');
    }

    const { error } = await client.storage
      .from('attachments')
      .remove([filePath]);

    if (error) {
      console.error('Erro ao excluir anexo:', error);
      throw error;
    }
  },

  /**
   * Cria uma URL assinada para visualizar um anexo privado.
   */
  getAttachmentUrl: async (
    filePath: string,
    expiresIn = 3600
  ): Promise<string> => {
    const client = getSupabase();

    if (!filePath) {
      throw new Error('Caminho do arquivo não informado.');
    }

    const { data, error } = await client.storage
      .from('attachments')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Erro ao gerar URL do anexo:', error);
      throw error;
    }

    return data.signedUrl;
  },
};
