import React, { useState, useEffect, useMemo } from 'react';
import { Product, AddedItem } from '../types';
import { formatCurrency, formatNumberDecimal, formatQuantity } from '../utils/formatters';
import { Plus, Eye, Trash2, ArrowDownCircle, ArrowUpCircle, Check, Search, X } from 'lucide-react';

interface ListaProdutosModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  addedItems: AddedItem[];
  onAddItem: (product: Product) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItemQuantity: (id: string, quantity: number) => void;
  onConfirmBaixaAll: () => void;
  onConfirmEntradaAll: () => void;
  onOpenPhoto: (product: Product) => void;
  onQuickBaixaItem: (product: Product, quantity: number) => void;
  onQuickEntradaItem: (product: Product, quantity: number) => void;
}

export const ListaProdutosModal: React.FC<ListaProdutosModalProps> = ({
  isOpen,
  onClose,
  products,
  addedItems,
  onAddItem,
  onRemoveItem,
  onUpdateItemQuantity,
  onConfirmBaixaAll,
  onConfirmEntradaAll,
  onOpenPhoto,
  onQuickBaixaItem,
  onQuickEntradaItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(''); // 798 in screenshot
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'pneus' | 'pecas' | 'oleos'>('all');

  // Keyboard navigation: ESC to close, F2 to confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F2') {
        e.preventDefault();
        onConfirmBaixaAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirmBaixaAll]);

  // Filter products by search term and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.codigoInterno.toLowerCase().includes(q) ||
        p.codigoBarras.toLowerCase().includes(q) ||
        p.descricao.toLowerCase().includes(q) ||
        p.marcaRefer.toLowerCase().includes(q) ||
        p.medida.toLowerCase().includes(q) ||
        p.ncm.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (activeTabFilter === 'pneus') return p.descricao.includes('PNEU');
      if (activeTabFilter === 'oleos') return p.descricao.includes('OLEO') || p.descricao.includes('DULUB') || p.descricao.includes('LUBRAX');
      if (activeTabFilter === 'pecas') return !p.descricao.includes('PNEU') && !p.descricao.includes('OLEO');

      return true;
    });
  }, [products, searchTerm, activeTabFilter]);

  if (!isOpen) return null;

  const totalAddedValue = addedItems.reduce((acc, item) => acc + item.valorTotal, 0);
  const totalAddedQuantity = addedItems.reduce((acc, item) => acc + item.qtdAdicionado, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-in fade-in duration-100">

      {/* Top Banner: LISTA DE PRODUTOS */}
      <div className="bg-[#003816] text-white py-1.5 px-4 flex items-center justify-between border-b-2 border-emerald-950 shrink-0">
        <div className="flex-1 text-center font-condensed font-bold tracking-wider text-2xl uppercase">
          LISTA DE PRODUTOS
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-emerald-200 p-1 rounded hover:bg-white/10"
          title="Fechar (ESC)"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col bg-[#e6eaed] overflow-hidden p-2 sm:p-3 space-y-2">

        {/* PESQUISA Area matching screenshot */}
        <div className="bg-white p-2 border border-slate-300 rounded shadow-xs shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-stretch border border-slate-400 rounded overflow-hidden">
            <span className="bg-[#001736] text-[#22c55e] px-3 py-1 text-xs font-mono font-bold flex items-center">
              Auto:
            </span>
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="PESQUISA (Digite código, código de barras, descrição ou medida...)"
              className="w-full px-3 py-1.5 text-base font-bold text-slate-900 bg-white focus:outline-none uppercase"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-2.5 text-slate-400 hover:text-slate-700 bg-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1 shrink-0 text-xs font-condensed font-bold uppercase">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTabFilter === 'all' ? 'bg-[#003816] text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('pneus')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTabFilter === 'pneus' ? 'bg-[#003816] text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Pneus
            </button>
            <button
              onClick={() => setActiveTabFilter('pecas')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTabFilter === 'pecas' ? 'bg-[#003816] text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Peças / Rodas
            </button>
            <button
              onClick={() => setActiveTabFilter('oleos')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTabFilter === 'oleos' ? 'bg-[#003816] text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Óleos / Lubrificantes
            </button>
          </div>
        </div>

        {/* TOP TABLE: Full Stock Catalog */}
        <div className="flex-1 bg-white border border-slate-300 rounded shadow-xs overflow-auto min-h-[220px]">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead>
              <tr className="bg-[#003816] text-white font-condensed font-bold tracking-wider uppercase text-[11px] sticky top-0 z-10 whitespace-nowrap">
                <th className="py-2 px-2.5 border-r border-emerald-900/60">CÓDIGO INTERNO</th>
                <th className="py-2 px-2.5 border-r border-emerald-900/60">CÓDIGO DE BARRAS</th>
                <th className="py-2 px-3 border-r border-emerald-900/60 min-w-[280px]">DESCRIÇÃO DO PRODUTO</th>
                <th className="py-2 px-2 border-r border-emerald-900/60 text-center">UNIDADE</th>
                <th className="py-2 px-2.5 border-r border-emerald-900/60">MARCA / REFER</th>
                <th className="py-2 px-2.5 border-r border-emerald-900/60 text-right">QTD ESTOQUE ATUAL</th>
                <th className="py-2 px-2.5 border-r border-emerald-900/60 text-right text-emerald-200">PREÇO VAREJO</th>
                <th className="py-2 px-2.5 border-r border-emerald-900/60 text-right text-sky-200">PREÇO ATACADO</th>
                <th className="py-2 px-2 border-r border-emerald-900/60 text-right">VALOR PROM</th>
                <th className="py-2 px-2 border-r border-emerald-900/60 text-center">FOTO</th>
                <th className="py-2 px-2.5 border-r border-emerald-900/60 text-center">ADICIONAR</th>
                <th className="py-2 px-2 border-r border-emerald-900/60">NCM</th>
                <th className="py-2 px-2 border-r border-emerald-900/60 text-right">PESO BRUTO</th>
                <th className="py-2 px-2 border-r border-emerald-900/60 text-right">PESO LIQUIDO</th>
                <th className="py-2 px-2.5">OBSERVAÇÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredProducts.map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#0099ff] text-white font-semibold'
                        : 'hover:bg-emerald-50 text-slate-800 odd:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-1 px-2.5 font-mono font-bold">{p.codigoInterno}</td>
                    <td className="py-1 px-2.5 font-mono">{p.codigoBarras}</td>
                    <td className="py-1 px-3 font-condensed font-bold text-sm uppercase">
                      {p.descricao}
                      {p.medida && (
                        <span className={`ml-2 text-xs font-normal ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                          ({p.medida})
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-center font-bold">{p.unidade}</td>
                    <td className="py-1 px-2.5 uppercase font-medium">{p.marcaRefer}</td>
                    <td className={`py-1 px-2.5 text-right font-mono font-bold ${
                      isSelected
                        ? 'text-white'
                        : p.estoqueAtual > 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}>
                      {formatQuantity(p.estoqueAtual)}
                    </td>
                    <td className="py-1 px-2.5 text-right font-mono font-bold">
                      {formatNumberDecimal(p.precoVarejo)}
                    </td>
                    <td className="py-1 px-2.5 text-right font-mono font-medium">
                      {formatNumberDecimal(p.precoAtacado)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono">
                      {formatNumberDecimal(p.valorProm)}
                    </td>
                    {/* FOTO: Olho button */}
                    <td className="py-1 px-2 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPhoto(p);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isSelected
                            ? 'text-white hover:bg-white/20'
                            : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100'
                        }`}
                        title="Ver foto e encaminhar no WhatsApp"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                    {/* ADICIONAR: Green Plus icon */}
                    <td className="py-1 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddItem(p);
                        }}
                        className={`p-1 rounded font-bold transition-transform active:scale-95 ${
                          isSelected
                            ? 'text-amber-300 hover:text-white'
                            : 'text-emerald-600 hover:text-emerald-800'
                        }`}
                        title="Adicionar à lista de itens abaixo"
                      >
                        <Plus size={20} className="stroke-[3]" />
                      </button>
                    </td>
                    <td className="py-1 px-2 font-mono text-slate-500">{p.ncm}</td>
                    <td className="py-1 px-2 text-right font-mono">{p.pesoBruto}</td>
                    <td className="py-1 px-2 text-right font-mono">{p.pesoLiquido}</td>
                    <td className="py-1 px-2.5 italic text-slate-500 truncate max-w-[200px]">
                      {p.observacao}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* BOTTOM SECTION: Itens adicionados matching screenshot */}
        <div className="shrink-0 space-y-1">
          {/* Dark Navy Title Bar matching image_12b779ee.png */}
          <div className="bg-[#03173e] text-white py-1 px-4 text-center font-bold text-xs uppercase tracking-wider font-condensed flex items-center justify-between">
            <span>Itens adicionados ({addedItems.length})</span>
            <div className="flex items-center gap-4 text-emerald-300 text-xs font-mono">
              <span>Qtd Total: <strong>{totalAddedQuantity}</strong></span>
              <span>Total Estimado: <strong>{formatCurrency(totalAddedValue)}</strong></span>
            </div>
          </div>

          {/* Lower Table of Added Items */}
          <div className="bg-white border border-slate-300 rounded shadow-xs max-h-48 overflow-y-auto">
            {addedItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-medium">
                Nenhum item adicionado ainda. Clique no ícone verde <strong>+</strong> na tabela acima ou dê ENTER no terminal para adicionar produtos para conferência e baixa.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="bg-[#003816] text-white font-condensed font-bold tracking-wider uppercase text-[11px] sticky top-0 z-10 whitespace-nowrap">
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60">CÓDIGO INTERNO</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60">CÓDIGO DE BARRAS</th>
                    <th className="py-1.5 px-3 border-r border-emerald-900/60 min-w-[250px]">DESCRIÇÃO DO PRODUTO</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60 text-right">QTD ESTOQUE ATUAL</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60 text-center bg-emerald-800">QTD ADICIONADO</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60 text-right">VALOR VAREJO</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60 text-right">VALOR ATACADO</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60 text-right">VALOR TOTAL</th>
                    <th className="py-1.5 px-2.5 border-r border-emerald-900/60">MARCA / REFERENCIA</th>
                    <th className="py-1.5 px-2 border-r border-emerald-900/60">TAMANHO / MEDIDA</th>
                    <th className="py-1.5 px-2 border-r border-emerald-900/60 text-center">FOTO</th>
                    <th className="py-1.5 px-2 text-center bg-rose-900">REMOVER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {addedItems.map((item) => {
                    const prodRef = products.find((p) => p.id === item.productId);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 whitespace-nowrap text-slate-800">
                        <td className="py-1 px-2.5 font-mono font-bold">{item.codigoInterno}</td>
                        <td className="py-1 px-2.5 font-mono">{item.codigoBarras}</td>
                        <td className="py-1 px-3 font-condensed font-bold uppercase">{item.descricao}</td>
                        <td className="py-1 px-2.5 text-right font-mono font-semibold text-slate-600">
                          {formatQuantity(item.estoqueAtual)}
                        </td>
                        {/* QTD ADICIONADO highlighted with soft green bg and blue text as in screenshot */}
                        <td className="py-1 px-2 text-center bg-[#d4edda] text-[#004085] font-bold font-mono">
                          <input
                            type="number"
                            min="1"
                            value={item.qtdAdicionado}
                            onChange={(e) => onUpdateItemQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 text-center bg-transparent font-bold font-mono focus:bg-white focus:outline-none rounded"
                          />
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono text-emerald-700 font-semibold">
                          {formatNumberDecimal(item.precoUnitario)}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono text-slate-600">
                          {formatNumberDecimal(prodRef?.precoAtacado || item.precoUnitario)}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900">
                          {formatNumberDecimal(item.valorTotal)}
                        </td>
                        <td className="py-1 px-2.5 uppercase text-slate-700">{item.marcaRefer}</td>
                        <td className="py-1 px-2 font-mono text-slate-700">{item.medida}</td>
                        {/* Olho Foto */}
                        <td className="py-1 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => prodRef && onOpenPhoto(prodRef)}
                            className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded"
                            title="Ver foto e encaminhar no WhatsApp"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                        {/* Remover: Red square X matching image_12b779ee.png */}
                        <td className="py-1 px-2 text-center bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer">
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="w-full h-full flex items-center justify-center p-0.5"
                            title="Remover este item"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Actions matching screenshot: VOLTAR (ESC) and CONFIRMAR (F2) */}
      <div className="bg-[#111827] px-4 py-2 flex items-center justify-between border-t border-slate-800 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="bg-[#e53935] hover:bg-[#d32f2f] active:bg-[#c62828] text-white font-condensed font-black px-6 py-2 rounded text-base uppercase tracking-wider shadow-md transition-colors"
        >
          VOLTAR (ESC)
        </button>

        <div className="flex items-center gap-2">
          {/* Button Dar Entrada */}
          <button
            type="button"
            disabled={addedItems.length === 0}
            onClick={onConfirmEntradaAll}
            className="bg-[#00702b] hover:bg-[#008a35] disabled:opacity-50 text-white font-condensed font-black px-5 py-2 rounded text-base uppercase tracking-wider shadow-md transition-colors flex items-center gap-1.5"
            title="Adicionar as quantidades ao estoque atual"
          >
            <ArrowUpCircle size={18} />
            <span>DAR ENTRADA NO ESTOQUE</span>
          </button>

          {/* Button Confirmar Baixa (F2) matching screenshot */}
          <button
            type="button"
            disabled={addedItems.length === 0}
            onClick={onConfirmBaixaAll}
            className="bg-[#003816] hover:bg-[#004d20] disabled:opacity-50 text-white font-condensed font-black px-8 py-2 rounded text-base uppercase tracking-wider shadow-md transition-colors flex items-center gap-2 border border-emerald-500/50"
            title="Dar baixa no estoque nas quantidades adicionadas (F2)"
          >
            <Check size={20} className="text-emerald-400 stroke-[3]" />
            <span>CONFIRMAR BAIXA (F2)</span>
          </button>
        </div>
      </div>

    </div>
  );
};
