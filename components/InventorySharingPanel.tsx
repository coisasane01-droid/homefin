import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share2, UserPlus, Trash2, RefreshCw, ShieldCheck } from 'lucide-react';

type SharedFamily = { familyId: string; createdAt: string };

export default function InventorySharingPanel({
  familyId,
  onAccessChange,
}: {
  familyId: string;
  onAccessChange?: () => void;
}) {
  const [ownerFamilyId, setOwnerFamilyId] = useState(familyId);
  const [isOwner, setIsOwner] = useState(true);
  const [families, setFamilies] = useState<SharedFamily[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const previousAccess = useRef<{ ownerFamilyId: string; isOwner: boolean } | null>(null);
  const onAccessChangeRef = useRef(onAccessChange);

  useEffect(() => {
    onAccessChangeRef.current = onAccessChange;
  }, [onAccessChange]);

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
    const expiry = Number(localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0);
    if (!token || expiry <= Date.now()) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      body: JSON.stringify({ action, familyId, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    return data;
  }, [familyId]);

  const refresh = useCallback(async () => {
    try {
      const data = await call('share-list');
      const nextOwner = data.ownerFamilyId || familyId;
      const nextIsOwner = Boolean(data.isOwner);
      const previous = previousAccess.current;

      setOwnerFamilyId(nextOwner);
      setIsOwner(nextIsOwner);
      setFamilies(Array.isArray(data.sharedFamilies) ? data.sharedFamilies : []);
      setLoaded(true);

      if (previous && (
        previous.ownerFamilyId !== nextOwner ||
        previous.isOwner !== nextIsOwner
      )) {
        onAccessChangeRef.current?.();
      }

      previousAccess.current = {
        ownerFamilyId: nextOwner,
        isOwner: nextIsOwner,
      };
    } catch (error) {
      setLoaded(true);
      setMessage(error instanceof Error ? error.message : 'Falha ao consultar compartilhamento.');
    }
  }, [call, familyId]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const add = async () => {
    if (!target.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await call('share-add', { targetFamilyId: target.trim().toLowerCase() });
      setTarget('');
      setMessage('Acesso concedido. A outra família já pode usar este Estoque.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível convidar a família.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (busy || !window.confirm(`Revogar o acesso da família ${id}?`)) return;
    setBusy(true);
    setMessage('');
    try {
      await call('share-remove', { targetFamilyId: id });
      setMessage('Acesso revogado. O Estoque particular da família convidada será preservado.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível revogar o acesso.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border p-4 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Share2 size={19} />
          <h2 className="font-bold">Compartilhamento do Estoque</h2>
        </div>
        <button onClick={() => void refresh()} title="Atualizar compartilhamento" className="rounded-lg border p-2 dark:border-gray-700">
          <RefreshCw size={16} />
        </button>
      </div>

      {!loaded ? (
        <p className="text-sm text-gray-500">Verificando acesso ao Estoque...</p>
      ) : isOwner ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Convide outras famílias pelo ID. Elas poderão consultar e alterar os mesmos produtos, saldos, preços e movimentações. Somente você gerencia os convites.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={target} onChange={event => setTarget(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') void add(); }}
              placeholder="ID da família convidada"
              className="min-w-0 flex-1 rounded-xl border p-3 dark:border-gray-700 dark:bg-gray-900" />
            <button onClick={() => void add()} disabled={busy || !target.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
              <UserPlus size={17} /> Convidar
            </button>
          </div>
          <div className="space-y-2">
            <strong className="text-sm">Famílias com acesso ({families.length})</strong>
            {families.map(item => (
              <div key={item.familyId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 dark:border-gray-700">
                <span className="break-all text-sm">{item.familyId}</span>
                <button onClick={() => void remove(item.familyId)} disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
                  <Trash2 size={15} /> Revogar
                </button>
              </div>
            ))}
            {!families.length && <p className="text-sm text-gray-500">Nenhuma família convidada ainda.</p>}
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <ShieldCheck size={20} className="mt-0.5 shrink-0" />
          <p>Você está usando o Estoque compartilhado pela família <strong>{ownerFamilyId}</strong>. As alterações feitas aqui são aplicadas ao mesmo Estoque. Você não pode convidar outras famílias.</p>
        </div>
      )}

      {message && <p role="status" className="text-sm text-blue-700 dark:text-blue-300">{message}</p>}
    </section>
  );
}
