import React from 'react';
import { Product, AddedItem } from '../types';
import { formatCurrency, formatNumberDecimal, formatQuantity } from '../utils/formatters';
import {
  Table,
  Eye,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  PackagePlus,
  AlertTriangle,
  X
} from 'lucide-react';

interface MovimentacaoEstoqueSectionProps {
  products: Product[];
  addedItems: AddedItem[];
  onRemoveItem: (id: string) => void;
  onUpdateItemQuantity: (id: string, quantity: number) => void;
  onClearAddedItems: () => void;
  onConfirmBaixaAll: () => void;
  onConfirmEntradaAll: () => void;
  onQuickBaixa: (product: Product, quantity: number) => void;
  onQuickEntrada: (product: Product, quantity: number) => void;
  onOpenPhoto: (product: Product) => void;
  onOpenCadastro: () => void;
  onOpenListaProdutos: () => void;
  onOpenHistorico: () => void;
  onOpenEstoqueCritico: () => void;
}

export const MovimentacaoEstoqueSection: React.FC<MovimentacaoEstoqueSectionProps> = ({
  products,
  addedItems,
  onRemoveItem,
  onUpdateItemQuantity,
  onClearAddedItems,
  onConfirmBaixaAll,
  onConfirmEntradaAll,
  onQuickBaixa,
  onQuickEntrada,
  onOpenPhoto,
  onOpenCadastro,
  onOpenListaProdutos,
  onOpenHistorico,
  onOpenEstoqueCritico
}) => {
  const totalCalculatedQueue = addedItems.reduce((acc, item) => acc + item.valorTotal, 0);
  const totalUnitsQueue = addedItems.reduce((acc, item) => acc + item.qtdAdicionado, 0);
  const negativeStockCount = products.filter((p) => p.estoqueAtual <= 0).length;

  return (
    <div className="@container flex flex-col space-y-3 w-full">
      {/* Header Action Strip matching image_7cc85eb9.png */}
      <div className="bg-white border-2 border-slate-300 rounded shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold font-condensed tracking-wide uppercase text-[#003816] flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#00a843] rounded-xs shrink-0"></span>
            <span>ITENS EM CONFERÊNCIA & MOVIMENTAÇÃO DE ESTOQUE</span>
          </h2>
          <p className="text-xs text-slate-500">
            Selecione os produtos acima ou em F12. Pressione <strong>ENTER</strong> para adicionar à conferência. A movimentação exige confirmação.
          </p>
        </div>

        {/* Quick KPI pills */}
        <div className="flex items-center gap-2 text-xs font-condensed font-bold">
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1.5 rounded">
            TOTAL PREVISTO: <strong className="text-sm font-mono ml-1">{formatCurrency(totalCalculatedQueue)}</strong>
          </div>
          <div className="bg-slate-100 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded font-mono">
            Qtd Itens: <strong>{totalUnitsQueue}</strong>
          </div>
        </div>
      </div>

      {/* Table of Active Queued Items */}
      <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col">

        <div className="bg-[#003816] text-white px-3 py-2 flex items-center justify-between font-condensed font-bold uppercase text-xs tracking-wider">
          <span>FILA DE CONFERÊNCIA E BAIXA ({addedItems.length} ITENS)</span>
          {addedItems.length > 0 && (
            <button
              type="button"
              onClick={onClearAddedItems}
              className="text-emerald-200 hover:text-white flex items-center gap-1 text-[11px] lowercase"
            >
              <Trash2 size={13} />
              <span>limpar tudo</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto min-h-[220px] max-h-[560px] overflow-y-auto">
          {addedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-slate-400 space-y-2 text-center">
              <Table size={44} className="opacity-40" />
              <p className="text-base font-bold font-condensed text-slate-600 uppercase">
                Nenhum item na lista de movimentação
              </p>
              <p className="text-xs text-slate-500 max-w-md">
                Digite o código ou descrição acima para selecionar ou abra a <strong>Tabela Produto (F12)</strong> para adicionar itens.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-condensed font-bold uppercase text-[11px] border-b border-slate-300 sticky top-0 z-10 whitespace-nowrap">
                  <th className="py-2 px-2.5 border-r border-slate-200">CÓD.</th>
                  <th className="py-2 px-3 border-r border-slate-200 min-w-[220px]">DESCRIÇÃO DO PRODUTO</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-center">MEDIDA</th>
                  <th className="py-2 px-2.5 border-r border-slate-200 text-right">ESTOQUE ATUAL</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-center bg-emerald-100/70 text-emerald-900 font-extrabold">
                    QTD MOVIMENTO
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-200 text-right">VALOR VAREJO</th>
                  <th className="py-2 px-2.5 border-r border-slate-200 text-right">VALOR ATACADO</th>
                  <th className="py-2 px-2.5 border-r border-slate-200 text-right font-bold text-slate-900">VALOR TOTAL</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-center">FOTO</th>
                  <th className="py-2 px-2 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {addedItems.map((item) => {
                  const prodRef = products.find((p) => p.id === item.productId);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 whitespace-nowrap">
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-800">
                        {item.codigoInterno}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-condensed font-bold uppercase text-slate-900 text-sm">
                          {item.descricao}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          EAN: {item.codigoBarras} • {item.marcaRefer}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-semibold text-slate-700 bg-slate-50">
                        {item.medida || '-'}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            item.estoqueAtual > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {formatQuantity(item.estoqueAtual)} {item.unidade}
                        </span>
                      </td>
                      {/* Qtd Movimento editable */}
                      <td className="py-2 px-2 text-center bg-emerald-50">
                        <input
                          type="number"
                          min="1"
                          value={item.qtdAdicionado}
                          onChange={(e) =>
                            onUpdateItemQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-14 text-center bg-white border border-emerald-400 rounded py-1 font-bold font-mono text-sm text-blue-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-inner"
                        />
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold text-emerald-700">
                        {formatNumberDecimal(item.precoUnitario)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                        {formatNumberDecimal(prodRef?.precoAtacado || item.precoUnitario)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-black text-slate-900 text-sm">
                        {formatNumberDecimal(item.valorTotal)}
                      </td>
                      {/* Eye / Photo modal with WhatsApp */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => prodRef && onOpenPhoto(prodRef)}
                          className="p-1.5 bg-slate-100 hover:bg-emerald-700 hover:text-white rounded text-emerald-800 transition-colors"
                          title="Ver foto e encaminhar no WhatsApp"
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                      {/* Action Buttons: Dar Baixa, Dar Entrada, Remover */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => prodRef && onQuickBaixa(prodRef, item.qtdAdicionado)}
                            className="bg-[#003816] hover:bg-[#004d20] text-white p-1.5 rounded transition-colors"
                            title={`Dar Baixa de ${item.qtdAdicionado} no estoque deste item`}
                          >
                            <ArrowDownCircle size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => prodRef && onQuickEntrada(prodRef, item.qtdAdicionado)}
                            className="bg-[#00702b] hover:bg-[#008a35] text-white p-1.5 rounded transition-colors"
                            title={`Dar Entrada de ${item.qtdAdicionado} no estoque deste item`}
                          >
                            <ArrowUpCircle size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white p-1.5 rounded transition-colors"
                            title="Remover da lista de conferência"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom confirmation action bar matching image_7cc85eb9.png */}
        <div className="bg-slate-100 p-3 border-t-2 border-slate-300 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Total de <strong>{addedItems.length}</strong> itens selecionados ({totalUnitsQueue} unidades a movimentar)
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={addedItems.length === 0}
              onClick={onConfirmEntradaAll}
              className="bg-[#00702b] hover:bg-[#008a35] disabled:opacity-50 text-white font-condensed font-black px-4 py-2 rounded text-sm uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all"
            >
              <ArrowUpCircle size={17} />
              <span>DAR ENTRADA EM TODOS (+ ESTOQUE)</span>
            </button>

            <button
              type="button"
              disabled={addedItems.length === 0}
              onClick={onConfirmBaixaAll}
              className="bg-[#003816] hover:bg-[#004d20] disabled:opacity-50 text-white font-condensed font-black px-5 py-2 rounded text-sm uppercase tracking-wide flex items-center gap-2 shadow-md transition-all border border-emerald-900"
            >
              <ArrowDownCircle size={18} className="text-emerald-400" />
              <span>CONFIRMAR BAIXA NO ESTOQUE (F2)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards: matching bottom of image_7cc85eb9.png */}
      <div className="grid grid-cols-1 gap-3 pt-1 [@container(min-width:480px)]:grid-cols-2 [@container(min-width:900px)]:grid-cols-3">
        <div className="bg-white p-3.5 rounded border border-slate-300 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-slate-500 block">TOTAL DE PRODUTOS</span>
            <span className="text-2xl font-black font-condensed text-[#003816]">{products.length} itens</span>
          </div>
          <button
            type="button"
            onClick={onOpenCadastro}
            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded border border-emerald-200 flex items-center gap-1 font-condensed uppercase"
          >
            <PackagePlus size={14} /> + CADASTRAR
          </button>
        </div>

        <div className="bg-white p-3.5 rounded border border-slate-300 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-slate-500 block">TABELA COMPLETA</span>
            <span className="text-xl xl:text-2xl font-black font-condensed text-slate-800 break-words">Visualizar</span>
          </div>
          <button
            type="button"
            onClick={onOpenListaProdutos}
            className="text-xs bg-[#003816] hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1 font-condensed uppercase tracking-wider"
          >
            <Table size={14} /> ABRIR (F12)
          </button>
        </div>

        {/* Card de Estoque Zerado / Risco de Esgotamento matching image_22849f8b.png */}
        {(() => {
          const zerados = products.filter((p) => p.estoqueAtual <= 0);
          const emRisco = products.filter((p) => {
            if (p.estoqueAtual <= 0) return false;
            const mediaMensal = p.vendaMediaMensal ?? (p.descricao.includes('PNEU') ? 10 : 8);
            return p.estoqueAtual <= (mediaMensal * 0.8); // Ex: vende 10/mes e tem 8 ou menos
          });
          const totalAlertas = zerados.length + emRisco.length;

          return (
            <div
              onClick={onOpenEstoqueCritico}
              className="p-3.5 rounded border border-amber-300 bg-amber-50 shadow-xs flex items-center justify-between cursor-pointer hover:bg-amber-100/70 hover:border-amber-400 transition-all group"
              title="Clique para ver itens zerados e produtos de alto giro prestes a acabar"
            >
              <div>
                <span className="text-[11px] uppercase font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 fill-amber-500/20" />
                  <span>ESTOQUE ZERADO / NEGATIVO</span>
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black font-condensed text-amber-950">
                    {totalAlertas} itens
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">
                    ({zerados.length} zerados • {emRisco.length} em risco)
                  </span>
                </div>
                <span className="text-[10px] text-amber-800/80 block mt-0.5">
                  Ex: Pneu que vende 10/mês e tem 5 ou 8 (vai zerar)
                </span>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEstoqueCritico();
                  }}
                  className="text-xs bg-white group-hover:bg-amber-600 group-hover:text-white border border-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded font-condensed uppercase tracking-wider transition-colors shadow-xs"
                >
                  VER ESTOQUE ZERADO
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenHistorico();
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                >
                  Ver Histórico
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
