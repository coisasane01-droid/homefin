export interface SupportMessage {
  id: string;
  family_id: string;
  sender_type: 'family' | 'admin';
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface SupportSettings {
  family_id: string;
  blocked: boolean;
  resolved: boolean;
  resolved_at: string | null;
  updated_at: string;
}

interface SupportResponse {
  success?: boolean;
  messages?: SupportMessage[];
  message?: SupportMessage;
  settings?: SupportSettings | null;
  updated?: number;
  error?: string;
}

async function request(
  action: string,
  familyId: string,
  values: Record<string, unknown> = {}
): Promise<SupportResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const adminToken = sessionStorage.getItem('homefin_admin_session_token');
  const adminExpiry = Number(sessionStorage.getItem('homefin_admin_session_expires_at') || 0);
  if (adminToken && adminExpiry > Date.now()) {
    headers.Authorization = `Bearer ${adminToken}`;
  } else {
    const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
    const expiresAt = Number(localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0);
    if (token && expiresAt > Date.now()) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch('/api/support', {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({ action, familyId, ...values }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Falha ao acessar o suporte (HTTP ${response.status}).`);
  }
  return result || {};
}

export const supportService = {
  async getMessages(familyId: string): Promise<SupportMessage[]> {
    return (await request('get-messages', familyId)).messages || [];
  },

  async getSupportSettings(familyId: string): Promise<SupportSettings> {
    const settings = (await request('get-settings', familyId)).settings;
    return settings || {
      family_id: familyId,
      blocked: false,
      resolved: false,
      resolved_at: null,
      updated_at: new Date().toISOString(),
    };
  },

  async sendMessage(
    familyId: string,
    message: string,
    _senderType: 'family' | 'admin'
  ): Promise<SupportMessage> {
    const cleanMessage = message.trim();
    if (!cleanMessage) throw new Error('A mensagem não pode estar vazia.');
    const result = await request('send-message', familyId, { message: cleanMessage });
    if (!result.message) throw new Error('O servidor não confirmou o envio da mensagem.');
    return result.message;
  },

  async setFamilyBlocked(familyId: string, blocked: boolean): Promise<SupportSettings> {
    const result = await request('set-blocked', familyId, { blocked });
    if (!result.settings) throw new Error('O servidor não confirmou a alteração.');
    return result.settings;
  },

  async getUnreadFamilyMessages(): Promise<SupportMessage[]> {
    return (await request('get-unread', '')).messages || [];
  },

  async markMessagesAsRead(
    familyId: string,
    _senderType: 'family' | 'admin'
  ): Promise<void> {
    await request('mark-read', familyId);
  },

  async setConversationResolved(
    familyId: string,
    resolved: boolean
  ): Promise<SupportSettings> {
    const result = await request('resolve', familyId, { resolved });
    if (!result.settings) throw new Error('O servidor não confirmou a alteração.');
    return result.settings;
  },

  async deleteConversation(familyId: string): Promise<void> {
    await request('delete', familyId);
  },
};
