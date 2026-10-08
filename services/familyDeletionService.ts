import { saasDb } from './saasDb';
import { supabaseService } from './supabaseService';
import { supportService } from './supportService';

export const familyDeletionService = {
  async deleteFamilyCompletely(familyId: string): Promise<void> {
    if (!familyId || familyId === 'v1') {
      throw new Error('Família inválida para exclusão.');
    }

    console.log('=== HOMEFIN - EXCLUSÃO COMPLETA DA FAMÍLIA ===');
    console.log('Família:', familyId);

    // 1. Exclui os dados financeiros da família no Supabase.
    await supabaseService.deleteFamilyData(familyId);

    // 2. Exclui mensagens e configurações de suporte da família.
    await supportService.deleteConversation(familyId);

    // 3. Remove a família do registro SaaS.
    await saasDb.deleteFamily(familyId);

    // 4. Remove dados locais específicos desta família.
    localStorage.removeItem(`homefin_data_${familyId}`);
    localStorage.removeItem(`homefin_user_pin_${familyId}`);
    localStorage.removeItem(`homefin_user_keyword_${familyId}`);

    // Remove também as chaves antigas sem sufixo, caso pertençam à sessão atual.
    const currentFamilyId = localStorage.getItem('homefin_current_family_id');

    if (currentFamilyId === familyId) {
      localStorage.removeItem('homefin_current_family_id');
      localStorage.removeItem('homefin_current_family_name');
      localStorage.removeItem('homefin_user_pin');
      localStorage.removeItem('homefin_user_keyword');
    }

    console.log('Família excluída completamente:', familyId);
  },
};
