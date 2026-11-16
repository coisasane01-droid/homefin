import React, { useState } from 'react';
import { inventoryService } from '../../../services/inventory';
import type { InventoryProduct } from '../../../types/inventory';

type Conflict = {
  id: string;
  local: InventoryProduct | null;
  remote: InventoryProduct | null;
};

type Props = {
  familyId: string;
  onResolved: () => Promise<void>;
};

const formatQuantity = (value: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

const formatMoney = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export function InventoryConflictsPanel({
  familyId,
  onResolved,
}: Props) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const loadConflicts = async () => {
    if (loading) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setLoaded(false);
    setConflicts([]);

    try {
      const result = await inventoryService.listConflicts(familyId);
      setConflicts(result);
      setLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar os conflitos.'
      );
    } finally {
      setLoading(false);
    }
  };

  const acceptRemote = async (conflict: Conflict) => {
    if (loading || resolvingId) return;

    if (!conflict.local || !conflict.remote?.updatedAt) {
      setError('As duas versões precisam estar disponíveis.');
      return;
    }

    const confirmed = window.confirm(
      'ATENÇÃO: a edição local deste produto será descartada. ' +
      'A versão confirmada pelo Supabase será mantida neste aparelho. ' +
      'Esta operação não poderá ser desfeita por este painel. Continuar?'
    );

    if (!confirmed) return;

    setResolvingId(conflict.id);
    setError('');
    setSuccess('');

    try {
      await inventoryService.acceptRemoteConflict(
        familyId,
        conflict.id,
        conflict.remote.updatedAt
      );

      setConflicts(current =>
        current.filter(item => item.id !== conflict.id)
      );

      try {
        await onResolved();

        setSuccess(
          'Conflito resolvido. A lista de produtos foi atualizada.'
        );
      } catch (refreshError) {
        setError(
          'O conflito foi resolvido, mas a atualização da tela falhou: ' +
          (refreshError instanceof Error
            ? refreshError.message
            : 'erro desconhecido')
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível resolver o conflito.'
      );

      // Impede confirmar novamente usando uma comparação desatualizada.
      setConflicts([]);
      setLoaded(false);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 pt-3">
      <div className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              Conflitos de sincronização
            </h2>
            <p className="text-xs text-slate-600">
              Compare alterações locais com o estoque confirmado no Supabase.
            </p>
          </div>

          <button
            type="button"
            onClick={loadConflicts}
            disabled={loading || Boolean(resolvingId)}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Consultando...' : 'Verificar conflitos'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="mt-3 text-sm text-green-700">
            {success}
          </p>
        )}

        {loaded && conflicts.length === 0 && !success && (
          <p className="mt-3 text-sm text-slate-600">
            Nenhum conflito registrado neste aparelho para o estoque autorizado.
          </p>
        )}

        {conflicts.map(conflict => (
          <div
            key={conflict.id}
            className="mt-3 rounded-md border border-amber-300 p-3"
          >
            <p className="mb-3 font-semibold text-slate-900">
              {conflict.local?.name || conflict.remote?.name || conflict.id}
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {([
                ['Versão local preservada', conflict.local],
                ['Versão atual do Supabase', conflict.remote],
              ] as const).map(([title, product]) => (
                <div
                  key={title}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <h3 className="mb-2 text-sm font-semibold">{title}</h3>

                  {product ? (
                    <div className="space-y-1 text-sm">
                      <p>Produto: {product.name}</p>
                      <p>Código: {product.sku || 'Não informado'}</p>
                      <p>Categoria: {product.category || 'Não informada'}</p>
                      <p>Quantidade: {formatQuantity(product.quantity)}</p>
                      <p>Mínimo: {formatQuantity(product.minimumQuantity)}</p>
                      <p>Custo: {formatMoney(product.costPrice)}</p>
                      <p>Varejo: {formatMoney(product.salePrice)}</p>
                      <p>Atacado: {formatMoney(product.wholesalePrice)}</p>
                      <p className="break-all text-xs text-slate-500">
                        Atualizado: {product.updatedAt || 'Não informado'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-800">
                      Versão indisponível. Nenhuma alteração será descartada.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={
                  loading ||
                  Boolean(resolvingId) ||
                  !conflict.local ||
                  !conflict.remote?.updatedAt
                }
                onClick={() => void acceptRemote(conflict)}
                className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {resolvingId === conflict.id
                  ? 'Resolvendo...'
                  : 'Manter versão do Supabase'}
              </button>

              <p className="text-xs text-amber-800">
                A edição local será descartada somente após sua confirmação.
                Nenhuma movimentação será enviada ao Supabase.
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
