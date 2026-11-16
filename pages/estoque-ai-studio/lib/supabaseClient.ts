import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Retorna um cliente Supabase ativo:
 * 1. Usa o cliente injetado diretamente pelo app principal HOMEFIN, se fornecido.
 * 2. Caso contrário, inicializa via VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Vercel / .env).
 * 3. Retorna null se não houver configuração Supabase (ativando automaticamente o modo localStorage).
 */
export function getSupabaseClient(externalClient?: SupabaseClient | null): SupabaseClient | null {
  if (externalClient) {
    return externalClient;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey || url.trim() === '' || anonKey.trim() === '') {
    return null;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return cachedClient;
}

export function isSupabaseConfigured(externalClient?: SupabaseClient | null): boolean {
  return Boolean(getSupabaseClient(externalClient));
}
