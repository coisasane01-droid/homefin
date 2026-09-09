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

  /**
   * Busca todos os dados de uma família.
   */
  getFamilyData: async (familyId: string): Promise<AppData | null> => {
    const client = getSupabase();

    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const { data, error } = await client
      .from('homefin_data')
      .select('data')
      .eq('family_id', familyId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar dados da família:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    return data.data as AppData;
  },

  /**
   * Salva ou atualiza todos os dados de uma família.
   *
   * Usa family_id como chave primária.
   * Se a família ainda não existir, cria.
   * Se já existir, atualiza.
   */
  saveFamilyData: async (
    familyId: string,
    appData: AppData
  ): Promise<HomeFinDataRow> => {
    const client = getSupabase();

    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const { data, error } = await client
      .from('homefin_data')
      .upsert(
        {
          family_id: familyId,
          data: appData,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'family_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar dados da família:', error);
      throw error;
    }

    return data as HomeFinDataRow;
  },

  /**
   * Cria uma família no Supabase caso ela ainda não exista.
   */
  createFamilyData: async (
    familyId: string,
    appData: AppData
  ): Promise<HomeFinDataRow> => {
    const client = getSupabase();

    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const { data, error } = await client
      .from('homefin_data')
      .insert({
        family_id: familyId,
        data: appData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar dados da família:', error);
      throw error;
    }

    return data as HomeFinDataRow;
  },

  /**
   * Verifica se uma família já possui dados no Supabase.
   */
  familyExists: async (familyId: string): Promise<boolean> => {
    const client = getSupabase();

    if (!familyId) {
      return false;
    }

    const { data, error } = await client
      .from('homefin_data')
      .select('family_id')
      .eq('family_id', familyId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar família:', error);
      throw error;
    }

    return !!data;
  },

  /**
   * Exclui todos os dados de uma família.
   */
  deleteFamilyData: async (familyId: string): Promise<void> => {
    const client = getSupabase();

    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const { error } = await client
      .from('homefin_data')
      .delete()
      .eq('family_id', familyId);

    if (error) {
      console.error('Erro ao excluir dados da família:', error);
      throw error;
    }
  },

  /**
   * Retorna a data da última sincronização.
   */
  getLastUpdate: async (familyId: string): Promise<string | null> => {
    const client = getSupabase();

    if (!familyId) {
      return null;
    }

    const { data, error } = await client
      .from('homefin_data')
      .select('updated_at')
      .eq('family_id', familyId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar última atualização:', error);
      throw error;
    }

    return data?.updated_at ?? null;
  },

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