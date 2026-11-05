import { clearFamilySession } from './familyAuth';

export const familyDeletionService = {
  async deleteFamilyCompletely(
    familyId: string
  ): Promise<{ storageCleanupPending: boolean }> {
    if (!familyId || familyId === 'v1') {
      throw new Error('Família inválida para exclusão.');
    }

    const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
    const expiresAt = Number(localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0);
    if (!token || expiresAt <= Date.now()) {
      throw new Error('Sua sessão expirou. Entre novamente antes de excluir a família.');
    }

    const response = await fetch('/api/family-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      body: JSON.stringify({ familyId }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success !== true) {
      throw new Error(result?.error || 'Não foi possível confirmar a exclusão no servidor.');
    }

    localStorage.removeItem(`homefin_data_${familyId}`);
    localStorage.removeItem(`homefin_pending_sync_${familyId}`);
    localStorage.removeItem(`homefin_user_pin_${familyId}`);
    localStorage.removeItem(`homefin_user_keyword_${familyId}`);
    clearFamilySession(familyId);

    try {
      const cachedSaasData = localStorage.getItem('homefin_saas_data_v1');
      if (cachedSaasData) {
        const saasData = JSON.parse(cachedSaasData);
        if (Array.isArray(saasData.families)) {
          saasData.families = saasData.families.filter((family: { id?: string }) => family.id !== familyId);
          localStorage.setItem('homefin_saas_data_v1', JSON.stringify(saasData));
        }
      }
    } catch (error) {
      console.error('Família excluída no servidor, mas o cache SaaS local não foi atualizado:', error);
    }

    if (localStorage.getItem('homefin_current_family_id') === familyId) {
      localStorage.removeItem('homefin_current_family_id');
      localStorage.removeItem('homefin_current_family_name');
      localStorage.removeItem('homefin_user_pin');
      localStorage.removeItem('homefin_user_keyword');
    }

    return { storageCleanupPending: result.storageCleanupPending === true };
  },
};
