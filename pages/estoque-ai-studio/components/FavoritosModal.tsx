import React from 'react';
import { Product } from '../types';
import { formatCurrency, formatQuantity } from '../utils/formatters';
import { Star, X, Eye, Plus } from 'lucide-react';

interface FavoritosModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onOpenPhoto: (product: Product) => void;
}

export const FavoritosModal: React.FC<FavoritosModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  onOpenPhoto,
}) => {
  if (!isOpen) return null;

  const favoritos = products.filter((p) => p.favorito);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden border-2 border-[#003816] animate-in zoom-in-95 duration-100">

        {/* Header */}
        <div className="bg-[#003816] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="text-amber-400 fill-amber-400" size={20} />
            <h2 className="text-lg font-bold uppercase font-condensed tracking-wide">
              Produtos Favoritos e Mais Consultados (F11)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-emerald-200 p-1 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-2">
          {favoritos.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-6">
              Nenhum item marcado como favorito ainda.
            </p>
          ) : (
            favoritos.map((p) => (
              <div
                key={p.id}
                className="p-3 bg-slate-50 hover:bg-emerald-50 rounded border border-slate-200 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={p.fotoUrl}
                    alt=""
                    className="w-12 h-12 object-contain bg-white rounded border p-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 font-condensed text-base uppercase truncate">
                      {p.descricao}
                    </h4>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                      <span>Cód: <strong>{p.codigoInterno}</strong></span>
                      <span>Medida: <strong className="text-slate-800">{p.medida}</strong></span>
                      <span>Estoque: <strong className={p.estoqueAtual > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {formatQuantity(p.estoqueAtual)} {p.unidade}
                      </strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right text-xs">
                    <div className="font-bold text-slate-900 font-mono">
                      {formatCurrency(p.precoVarejo)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Atac: {formatCurrency(p.precoAtacado)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenPhoto(p)}
                    className="p-1.5 bg-slate-200 hover:bg-emerald-700 hover:text-white rounded text-slate-700 transition-colors"
                    title="Ver foto e encaminhar no WhatsApp"
                  >
                    <Eye size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectProduct(p);
                      onClose();
                    }}
                    className="bg-[#003816] hover:bg-emerald-800 text-white font-condensed font-bold text-xs py-1.5 px-3 rounded flex items-center gap-1 shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Selecionar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-4 py-2 border-t text-right">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 uppercase"
          >
            Fechar (Esc)
          </button>
        </div>

      </div>
    </div>
  );
};
