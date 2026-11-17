import React from 'react';
import { StockMovement } from '../../types/inventory-ai-studio';
import { X, ArrowDownCircle, ArrowUpCircle, Trash2 } from 'lucide-react';

interface HistoricoMovimentacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements: StockMovement[];
  onClearHistory: () => void;
  estoqueNome?: string;
}

export const HistoricoMovimentacaoModal: React.FC<HistoricoMovimentacaoModalProps> = ({
  isOpen,
  onClose,
  movements,
  onClearHistory,
  estoqueNome,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden border-2 border-[#003816] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-100">

        {/* Header */}
        <div className="bg-[#003816] text-white px-5 py-3.5 flex items-center justify-between border-b border-emerald-950">
          <div className="flex flex-col">
            <span className="font-condensed font-bold text-lg uppercase tracking-wider">
              Histórico de Movimentações de Estoque (Baixas e Entradas)
            </span>
            {estoqueNome && (
              <span className="text-[11px] text-emerald-200">
                Estoque atual: <strong>{estoqueNome}</strong>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-emerald-200 p-1 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {movements.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Nenhuma movimentação de estoque registrada nesta sessão.
            </div>
          ) : (
            <div className="border border-slate-300 rounded overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 font-condensed font-bold uppercase text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3">Data / Hora</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Cód.</th>
                    <th className="py-2 px-3">Descrição do Produto</th>
                    <th className="py-2 px-3">Família</th>
                    <th className="py-2 px-3 text-center">Quantidade</th>
                    <th className="py-2 px-3 text-right">Estoque Anterior</th>
                    <th className="py-2 px-3 text-right">Novo Estoque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap font-mono">{m.timestamp}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {m.tipo === 'baixa' ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[11px] uppercase">
                            <ArrowDownCircle size={13} />
                            <span>Baixa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] uppercase">
                            <ArrowUpCircle size={13} />
                            <span>Entrada</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold">{m.codigoInterno}</td>
                      <td className="py-2 px-3 font-condensed font-bold uppercase text-slate-900">{m.descricao}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                        {m.familiaNome || '-'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-sm">
                        {m.tipo === 'baixa' ? `-${m.quantidade}` : `+${m.quantidade}`}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{m.estoqueAnterior.toFixed(0)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{m.estoqueNovo.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-300 flex items-center justify-between">
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs text-rose-700 hover:text-rose-900 font-medium flex items-center gap-1"
          >
            <Trash2 size={14} />
            <span>Limpar Histórico</span>
          </button>
          <button
            onClick={onClose}
            className="bg-[#003816] hover:bg-emerald-800 text-white font-condensed font-bold text-xs py-1.5 px-4 rounded uppercase tracking-wider"
          >
            Fechar (Esc)
          </button>
        </div>

      </div>
    </div>
  );
};
