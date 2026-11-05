import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppData } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

function getAttachmentSession(familyId?: string): { familyId: string; token: string } {
  const currentFamilyId = familyId || localStorage.getItem('homefin_current_family_id') || '';
  const token = currentFamilyId
    ? localStorage.getItem(`homefin_family_session_token_${currentFamilyId}`)
    : null;
  const expiresAt = currentFamilyId
    ? Number(localStorage.getItem(`homefin_family_session_expires_at_${currentFamilyId}`) || 0)
    : 0;
  if (!currentFamilyId || currentFamilyId === 'v1' || !token || expiresAt <= Date.now()) {
    throw new Error('Sessão familiar expirada. Entre novamente para acessar anexos.');
  }
  return { familyId: currentFamilyId, token };
}

async function requestAttachment(
  familyId: string | undefined,
  payload: Record<string, unknown>
): Promise<any> {
  const session = getAttachmentSession(familyId);
  const response = await fetch('/api/family-attachments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({ ...payload, familyId: session.familyId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || `Falha ao acessar anexo (HTTP ${response.status}).`);
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function requestSaasData(action: 'get' | 'save', saasData?: any): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const adminToken = sessionStorage.getItem('homefin_admin_session_token');
  const adminExpiry = Number(sessionStorage.getItem('homefin_admin_session_expires_at') || 0);
  if (adminToken && adminExpiry > Date.now()) {
    headers.Authorization = `Bearer ${adminToken}`;
  } else {
    const familyId = localStorage.getItem('homefin_current_family_id') || '';
    const familyToken = familyId
      ? localStorage.getItem(`homefin_family_session_token_${familyId}`)
      : null;
    const familyExpiry = familyId
      ? Number(localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0)
      : 0;
    if (familyToken && familyExpiry > Date.now()) {
      headers.Authorization = `Bearer ${familyToken}`;
    }
  }

  const response = await fetch('/api/saas-data', {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({
      action,
      ...(saasData ? { data: saasData } : {}),
      ...(localStorage.getItem('homefin_current_family_id')
        ? { familyId: localStorage.getItem('homefin_current_family_id') }
        : {}),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Falha ao acessar configuração SaaS (HTTP ${response.status}).`);
  }
  return result?.data ?? null;
}

async function requestFamilyData(
  action: 'get' | 'save' | 'exists' | 'delete',
  familyId: string,
  appData?: AppData,
  expectedUpdatedAt?: string | null
): Promise<any> {
  const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
  const expiresAt = Number(localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0);
  if (!token || expiresAt <= Date.now()) {
    throw new Error('Sessão familiar expirada. Entre novamente para acessar os dados.');
  }
  const response = await fetch('/api/family-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({
      action,
      familyId,
      ...(appData ? { data: appData, expectedUpdatedAt } : {}),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || `Falha ao acessar dados familiares (HTTP ${response.status}).`);
  }
  return result;
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
      return (await requestFamilyData('get', familyId)).data ?? null;
    },

  saveFamilyData: async (
    familyId: string,
    appData: AppData,
    expectedUpdatedAt: string | null
  ): Promise<HomeFinDataRow> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    const result = await requestFamilyData('save', familyId, appData, expectedUpdatedAt);
    return {
      family_id: familyId,
      data: appData,
      updated_at: result.updatedAt,
    };
  },

  createFamilyData: async (
    familyId: string,
    appData: AppData
  ): Promise<HomeFinDataRow> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    return supabaseService.saveFamilyData(familyId, appData, null);
  },

  familyExists: async (familyId: string): Promise<boolean> => {
    if (!familyId) {
      return false;
    }

    const result = await requestFamilyData('exists', familyId);
    return result.exists === true;
  },

  deleteFamilyData: async (familyId: string): Promise<void> => {
    if (!familyId) {
      throw new Error('familyId não informado.');
    }

    await requestFamilyData('delete', familyId);
  },

  getLastUpdate: async (familyId: string): Promise<string | null> => {
    if (!familyId) {
      return null;
    }

    const result = await requestFamilyData('get', familyId);
    return result.updatedAt ?? null;
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
    return requestSaasData('get');
  },

  /**
   * Salva ou atualiza toda a configuração SaaS.
   *
   * Usa uma única linha com id = "global".
   */
  saveSaasData: async (saasData: any): Promise<HomeFinSaasRow> => {
    const safeSaasData = structuredClone(saasData);
    if (safeSaasData?.paymentConfig) {
      delete safeSaasData.paymentConfig.mercadoPagoAccessToken;
    }
    const data = await requestSaasData('save', safeSaasData);
    return { id: 'global', data, updated_at: new Date().toISOString() };
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
    if (!file) {
      throw new Error('Arquivo não informado.');
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('O anexo deve ter até 3 MB.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';
    const result = await requestAttachment(familyId, {
      action: 'upload',
      name: file.name,
      contentType,
      base64: bytesToBase64(bytes),
    });
    return { path: result.path, id: result.id, fullPath: result.fullPath };
  },

  /**
   * Remove um anexo do Storage.
   */
  deleteAttachment: async (filePath: string, familyId?: string): Promise<void> => {
    if (!filePath) {
      throw new Error('Caminho do arquivo não informado.');
    }
    await requestAttachment(familyId, { action: 'delete', path: filePath });
  },

  pruneAttachments: async (familyId?: string): Promise<number> => {
    const result = await requestAttachment(familyId, { action: 'prune' });
    return Number(result.removed || 0);
  },

  /**
   * Cria uma URL assinada para visualizar um anexo privado.
   */
  getAttachmentUrl: async (
    filePath: string,
    expiresIn = 3600,
    familyId?: string
  ): Promise<string> => {
    if (!filePath) {
      throw new Error('Caminho do arquivo não informado.');
    }
    if (filePath.startsWith('data:')) return filePath;
    const result = await requestAttachment(familyId, {
      action: 'sign',
      path: filePath,
      expiresIn,
    });
    return result.url;
  },
};
