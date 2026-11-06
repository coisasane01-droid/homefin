import { supabase } from './supabaseService';

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

export const supportService = {
  async getMessages(familyId: string): Promise<SupportMessage[]> {
    const { data, error } = await supabase
      .from('homefin_support_messages')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens do suporte:', error);
      throw error;
    }

    return data || [];
  },

  async getSupportSettings(
    familyId: string
  ): Promise<SupportSettings> {
    const { data, error } = await supabase
      .from('homefin_support_settings')
      .select('*')
      .eq('family_id', familyId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configuração do suporte:', error);
      throw error;
    }

    if (!data) {
      return {
        family_id: familyId,
        blocked: false,
        resolved: false,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      };
    }

    return data;
  },

  async sendMessage(
    familyId: string,
    message: string,
    senderType: 'family' | 'admin'
  ): Promise<SupportMessage> {
    const cleanMessage = message.trim();

    if (!cleanMessage) {
      throw new Error('A mensagem não pode estar vazia.');
    }

    // A família não pode enviar mensagens quando estiver bloqueada.
    if (senderType === 'family') {
      const settings = await this.getSupportSettings(familyId);

      if (settings.blocked) {
        throw new Error(
          'O envio de mensagens está temporariamente bloqueado pelo administrador.'
        );
      }
    }

    const { data, error } = await supabase
      .from('homefin_support_messages')
      .insert({
        family_id: familyId,
        sender_type: senderType,
        message: cleanMessage,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao enviar mensagem do suporte:', error);
      throw error;
    }

    return data;
  },

  async setFamilyBlocked(
    familyId: string,
    blocked: boolean
  ): Promise<SupportSettings> {
    const { data, error } = await supabase
      .from('homefin_support_settings')
      .upsert(
        {
          family_id: familyId,
          blocked,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'family_id',
        }
      )
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao alterar bloqueio do suporte:', error);
      throw error;
    }

    return data;
  },

  async getUnreadFamilyMessages(): Promise<SupportMessage[]> {
    const { data, error } = await supabase
      .from('homefin_support_messages')
      .select('*')
      .eq('sender_type', 'family')
      .is('read_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens não lidas do suporte:', error);
      throw error;
    }

    return data || [];
  },

  async markMessagesAsRead(
    familyId: string,
    senderType: 'family' | 'admin'
  ): Promise<void> {
    const { error } = await supabase
      .from('homefin_support_messages')
      .update({
        read_at: new Date().toISOString(),
      })
      .eq('family_id', familyId)
      .eq('sender_type', senderType)
      .is('read_at', null);

    if (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
      throw error;
    }
  },

  async setConversationResolved(
    familyId: string,
    resolved: boolean
  ): Promise<SupportSettings> {
    const { data, error } = await supabase
      .from('homefin_support_settings')
      .upsert(
        {
          family_id: familyId,
          resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'family_id',
        }
      )
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao alterar status da conversa:', error);
      throw error;
    }

    return data;
  },

  async deleteConversation(familyId: string): Promise<void> {
    const { error: messagesError } = await supabase
      .from('homefin_support_messages')
      .delete()
      .eq('family_id', familyId);

    if (messagesError) {
      console.error('Erro ao excluir mensagens do suporte:', messagesError);
      throw messagesError;
    }

    const { error: settingsError } = await supabase
      .from('homefin_support_settings')
      .delete()
      .eq('family_id', familyId);

    if (settingsError) {
      console.error('Erro ao excluir configuração do suporte:', settingsError);
      throw settingsError;
    }
  },
};