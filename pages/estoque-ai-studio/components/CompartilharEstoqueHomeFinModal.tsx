import { homefinApiUrl } from '../../../services/nativeApi';
import { getFamilySessionToken } from '../../../services/familyAuth';
import React, { useEffect, useState } from 'react';
import { X, Users, UserPlus, Trash2 } from 'lucide-react';

interface Sharing {
  ownerFamilyId: string;
  isOwner: boolean;
  sharedFamilies: Array<{ familyId: string; createdAt: string }>;
}

interface Props {
  familyId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function CompartilharEstoqueHomeFinModal({
  familyId,
  onClose,
  onChanged,
}: Props) {
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function request(action: string, targetFamilyId?: string) {
    if (!navigator.onLine) {
      throw new Error('Conecte-se à internet para gerenciar o compartilhamento.');
    }

    const token = await getFamilySessionToken(familyId);

    if (!token) {
      throw new Error('Sua sessão expirou. Entre novamente no HomeFin.');
    }

    const response = await fetch(homefinApiUrl('/api/inventory'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      body: JSON.stringify({ action, familyId, targetFamilyId }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'Não foi possível realizar a operação.');
    }

    return result;
  }

  async function refresh() {
    const result = await request('share-list');
    setSharing(result as Sharing);
  }

  useEffect(() => {
    let active = true;

    request('share-list')
      .then(result => {
        if (active) setSharing(result as Sharing);
      })
      .catch(err => {
        if (active) setError(err.message);
      });

    return () => { active = false; };
  }, [familyId]);

  async function addFamily() {
    const id = target.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) {
      setError('Informe o identificador válido da família.');
      return;
    }

    if (!sharing?.isOwner) return;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await request('share-add', id);
      await refresh();
      setTarget('');
      setSuccess('Família autorizada com sucesso.');
      try {
        await onChanged();
      } catch {
        setError('Autorização salva, mas não foi possível atualizar a tela.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autorizar.');
    } finally {
      setBusy(false);
    }
  }

  async function removeFamily(id: string) {
    if (!sharing?.isOwner || busy) return;

    if (!window.confirm(
      `Revogar o acesso da família "${id}" ao estoque compartilhado?`
    )) return;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await request('share-remove', id);
      await refresh();
      setSuccess('Autorização revogada com sucesso.');
      try {
        await onChanged();
      } catch {
        setError('Revogação salva, mas não foi possível atualizar a tela.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao revogar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-xl rounded-lg shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="bg-[#003816] text-white p-4 flex justify-between items-center gap-3">
          <h2 className="font-bold uppercase flex items-center gap-2">
            <Users size={20} />
            Compartilhar Estoque
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded text-sm">
              {success}
            </div>
          )}

          {!sharing && !error && <p>Carregando autorizações...</p>}

          {sharing && (
            <>
              <div className="bg-slate-100 rounded p-3 text-sm">
                <p>
                  <strong>Família proprietária:</strong>{' '}
                  {sharing.ownerFamilyId}
                </p>
                <p className="mt-1">
                  {sharing.isOwner
                    ? 'Você pode autorizar outras famílias.'
                    : 'Sua família utiliza um estoque compartilhado. Somente a proprietária pode alterar autorizações.'}
                </p>
              </div>

              {sharing.isOwner && (
                <div className="space-y-2">
                  <label className="block font-bold text-sm">
                    Identificador da família que receberá acesso
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={target}
                      onChange={e => setTarget(e.target.value)}
                      placeholder="ID da família"
                      className="border border-slate-300 rounded p-2 flex-1 min-w-0"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      disabled={busy || !target.trim()}
                      onClick={addFamily}
                      className="bg-[#003816] text-white px-4 py-2 rounded font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <UserPlus size={16} />
                      Autorizar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold mb-2">
                  Famílias autorizadas ({sharing.sharedFamilies.length})
                </h3>

                {sharing.sharedFamilies.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Nenhuma outra família autorizada.
                  </p>
                )}

                <div className="space-y-2">
                  {sharing.sharedFamilies.map(item => (
                    <div
                      key={item.familyId}
                      className="border rounded p-3 flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-medium break-all">
                        {item.familyId}
                      </span>

                      {sharing.isOwner && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeFamily(item.familyId)}
                          className="text-red-700 border border-red-200 rounded px-3 py-2 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Revogar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
