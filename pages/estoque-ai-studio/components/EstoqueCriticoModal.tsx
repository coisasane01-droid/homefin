import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { formatCurrency, formatQuantity } from '../utils/formatters';
import {
  X,
  AlertTriangle,
  Flame,
  ArrowUpCircle,
  Eye,
  Plus,
  Minus,
  Share2,
  Copy,
  Check,
  Clock,
  Boxes,
  Ruler,
  Tag
} from 'lucide-react';

interface EstoqueCriticoModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onOpenPhoto: (product: Product) => void;
  onQuickEntrada: (product: Product, quantity: number) => void;
  onAddItemToQueue: (product: Product, quantity: number) => void;
  onUpdateProductSalesRate: (productId: string, newRate: number) => void;
}

export const EstoqueCriticoModal: React.FC<EstoqueCriticoModalProps> = ({
  isOpen,
  onClose,
  products,
  onOpenPhoto,
  onQuickEntrada,
  onAddItemToQueue,
  onUpdateProductSalesRate,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'zerados' | 'risco'>('all');
  const [copied, setCopied] = useState(false);
  const [entradaInputProduct, setEntradaInputProduct] = useState<{ id: string; qtd: number } | null>(null);

  // Calculate criticality for every product based on stock and monthly sales velocity
  const analyzedProducts = useMemo(() => {
    return products.map((p) => {
      const vendaMensal = p.vendaMediaMensal ?? (p.descricao.includes('PNEU') ? 10 : 8);
      const estoque = p.estoqueAtual;

      let diasRestantes = 0;
      let status: 'zerado' | 'risco_alto' | 'risco_medio' | 'ok' = 'ok';

      if (estoque <= 0) {
        diasRestantes = 0;
        status = 'zerado';
      } else {
        const vendasPorDia = vendaMensal / 30;
        diasRestantes = Math.round(estoque / vendasPorDia);

        // Exemplo citado: vende 10/mês e tem 5 ou 8 -> vai zerar em breve!
        if (diasRestantes <= 18 || estoque <= (vendaMensal * 0.6)) {
          status = 'risco_alto';
        } else if (diasRestantes <= 30 || estoque <= (vendaMensal * 0.9)) {
          status = 'risco_medio';
        } else {
          status = 'ok';
        }
      }

      // Sugestão de reposição para cobrir pelo menos 30 dias de giro
      const metaEstoque = Math.max(vendaMensal, 10);
      const sugestaoCompra = Math.max(0, Math.ceil(metaEstoque - estoque));

      return {
        ...p,
        vendaMensal,
        diasRestantes,
        status,
        sugestaoCompra
      };
    });
  }, [products]);

  // Filter based on tab
  const filteredList = useMemo(() => {
    return analyzedProducts.filter((item) => {
      if (activeTab === 'zerados') {
        return item.status === 'zerado';
      }
      if (activeTab === 'risco') {
        return item.status === 'risco_alto' || item.status === 'risco_medio';
      }
      return item.status === 'zerado' || item.status === 'risco_alto' || item.status === 'risco_medio';
    });
  }, [analyzedProducts, activeTab]);

  // KPI counters
  const zeradosCount = analyzedProducts.filter((p) => p.status === 'zerado').length;
  const riscoAltoCount = analyzedProducts.filter((p) => p.status === 'risco_alto').length;
  const riscoMedioCount = analyzedProducts.filter((p) => p.status === 'risco_medio').length;
  const totalCriticos = zeradosCount + riscoAltoCount + riscoMedioCount;

  if (!isOpen) return null;

  // Format supplier replenishment list to send via WhatsApp or copy
  const generateReplenishmentListText = () => {
    const lines = filteredList.map((item) => {
      return `• *${item.descricao}* (Medida: ${item.medida})\n  Cód: ${item.codigoInterno} | Atual: ${item.estoqueAtual.toFixed(0)} | Vende: ~${item.vendaMensal}/mês | *Pedir: +${item.sugestaoCompra} ${item.unidade}*`;
    });

    return (
      `*LISTA DE REPOSIÇÃO DE ESTOQUE - PRODUTOS CRÍTICOS*\n` +
      `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n` +
      `🚨 *Itens em falta ou com risco de esgotamento:*\n\n` +
      lines.join('\n\n') +
      `\n\n_Favor informar prazo de entrega e preços de atacado._`
    );
  };

  const handleCopyList = () => {
    navigator.clipboard.writeText(generateReplenishmentListText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateReplenishmentListText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleApplyEntrada = (product: Product, qtd: number) => {
    onQuickEntrada(product, qtd);
    setEntradaInputProduct(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex sm:items-center sm:justify-center p-0 sm:p-3 overflow-hidden animate-in fade-in duration-100">

      {/* Modal Dialog Container - Full screen on mobile, bounded on desktop */}
      <div className="bg-[#f0f2f5] text-slate-800 rounded-none sm:rounded-lg shadow-2xl max-w-6xl w-full h-[100dvh] sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden border-0 sm:border-2 border-amber-600">

        {/* Sticky Header Bar */}
        <div className="bg-[#b45309] text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b border-amber-800 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-200 fill-amber-300/30 shrink-0" />
            <div>
              <h2 className="text-base sm:text-xl font-bold tracking-tight font-condensed uppercase leading-tight">
                ESTOQUE CRÍTICO, ZERADOS & ALERTA DE RUPTURA
              </h2>
              <span className="text-[11px] text-amber-100 font-medium hidden sm:inline">
                Monitoramento de itens zerados e produtos de alto giro prestes a acabar
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-amber-100 hover:text-white p-1 rounded hover:bg-white/10"
            title="Fechar (Esc)"
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Modal Body: Contains all info, cards, filters and products */}
        <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col bg-[#e9ecef]">

          {/* Top Info Banner explaining sales velocity calculation */}
          <div className="bg-amber-50 border-b border-amber-200 p-2.5 sm:p-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
            <div className="flex items-start sm:items-center gap-1.5">
              <Flame size={15} className="text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
              <span className="leading-tight">
                <strong>Previsão de Esgotamento:</strong> Produtos com saída (ex: <strong>10 un/mês</strong>) com estoque de <strong>5 a 8 un</strong> vão zerar em poucos dias e precisam de reposição.
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyList}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold px-2.5 py-1.5 rounded text-xs flex items-center justify-center gap-1 shadow-xs transition-colors"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copied ? 'Copiado!' : 'Copiar Lista'}</span>
              </button>

              <button
                onClick={handleSendWhatsApp}
                className="flex-1 sm:flex-initial bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1 shadow-xs transition-colors font-condensed"
              >
                <Share2 size={13} />
                <span>Mandar no WhatsApp</span>
              </button>
            </div>
          </div>

          {/* KPI Counter Cards - Responsive grid */}
          <div className="p-2 sm:p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 bg-slate-200/80 border-b border-slate-300">

            <div
              onClick={() => setActiveTab('zerados')}
              className={`p-2 rounded border transition-all cursor-pointer ${
                activeTab === 'zerados' ? 'bg-red-50 border-red-500 shadow-md ring-1 ring-red-400' : 'bg-white border-slate-300 hover:bg-red-50/50'
              }`}
            >
              <div className="text-[10px] sm:text-[11px] font-bold text-red-800 uppercase flex items-center gap-1 truncate">
                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0"></span>
                <span className="truncate">1. Totalmente Zerados</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-condensed text-red-700 mt-0.5">
                {zeradosCount} itens
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Estoque zero ou negativo</span>
            </div>

            <div
              onClick={() => setActiveTab('risco')}
              className={`p-2 rounded border transition-all cursor-pointer ${
                activeTab === 'risco' ? 'bg-orange-50 border-orange-500 shadow-md ring-1 ring-orange-400' : 'bg-white border-slate-300 hover:bg-orange-50/50'
              }`}
            >
              <div className="text-[10px] sm:text-[11px] font-bold text-orange-800 uppercase flex items-center gap-1 truncate">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                <span className="truncate">2. Vão Zerar em Breve</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-condensed text-orange-700 mt-0.5">
                {riscoAltoCount} itens
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Esgotam em &lt; 18 dias</span>
            </div>

            <div
              onClick={() => setActiveTab('risco')}
              className="p-2 rounded border bg-white border-slate-300 hover:bg-amber-50/50 cursor-pointer"
            >
              <div className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span className="truncate">3. Atenção no Giro</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-condensed text-amber-700 mt-0.5">
                {riscoMedioCount} itens
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Abaixo da média mensal</span>
            </div>

            <div
              onClick={() => setActiveTab('all')}
              className={`p-2 rounded border transition-all cursor-pointer ${
                activeTab === 'all' ? 'bg-[#003816] text-white border-[#00240e] shadow-md' : 'bg-white border-slate-300 hover:bg-slate-100'
              }`}
            >
              <div className={`text-[10px] sm:text-[11px] font-bold uppercase flex items-center gap-1 truncate ${activeTab === 'all' ? 'text-emerald-300' : 'text-slate-700'}`}>
                <Boxes size={12} className="shrink-0" />
                <span className="truncate">Total sob Alerta</span>
              </div>
              <div className={`text-xl sm:text-2xl font-black font-condensed mt-0.5 ${activeTab === 'all' ? 'text-white' : 'text-[#003816]'}`}>
                {totalCriticos} itens
              </div>
              <span className={`text-[9px] sm:text-[10px] block truncate ${activeTab === 'all' ? 'text-emerald-200' : 'text-slate-500'}`}>
                Ver todos os itens
              </span>
            </div>

          </div>

          {/* Sticky Tab Filters */}
          <div className="sticky top-0 z-10 px-2 sm:px-4 py-2 bg-slate-100 border-b border-slate-300 shadow-xs flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-condensed font-bold uppercase overflow-x-auto">
            <span className="text-slate-500 mr-0.5 hidden sm:inline">Filtrar:</span>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded whitespace-nowrap transition-colors ${
                activeTab === 'all' ? 'bg-[#003816] text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Todos ({totalCriticos})
            </button>
            <button
              onClick={() => setActiveTab('zerados')}
              className={`px-2.5 py-1 rounded whitespace-nowrap transition-colors ${
                activeTab === 'zerados' ? 'bg-red-700 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Zerados ({zeradosCount})
            </button>
            <button
              onClick={() => setActiveTab('risco')}
              className={`px-2.5 py-1 rounded whitespace-nowrap transition-colors ${
                activeTab === 'risco' ? 'bg-orange-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Vão Zerar ({riscoAltoCount + riscoMedioCount})
            </button>
          </div>

          {/* PRODUCTS CONTAINER */}
          <div className="p-2 sm:p-3 space-y-2">

            {filteredList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-1 bg-white rounded-lg border border-slate-300">
                <Check size={36} className="mx-auto text-emerald-600 mb-2" />
                <p className="text-base font-bold text-slate-700 font-condensed uppercase">
                  Nenhum produto crítico nesta categoria!
                </p>
                <p className="text-xs text-slate-500">
                  Seu estoque está abastecido para o giro mensal estipulado.
                </p>
              </div>
            ) : (
              <>
                {/* 1. MODO CELULAR: CARDS VERTICAIS INDIVIDUAIS (md:hidden) */}
                <div className="block md:hidden space-y-2.5">
                  {filteredList.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white rounded-lg p-3 border-2 shadow-xs space-y-2.5 transition-all ${
                        item.status === 'zerado'
                          ? 'border-red-400 bg-red-50/20'
                          : item.status === 'risco_alto'
                          ? 'border-orange-400 bg-orange-50/20'
                          : 'border-amber-300'
                      }`}
                    >
                      {/* Top Row: Description & Status Tag */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-condensed font-black text-sm uppercase text-slate-900 leading-tight">
                            {item.descricao}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                            <span className="bg-slate-100 px-1 rounded border border-slate-200">Cód: {item.codigoInterno}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-800">{item.medida}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          {item.status === 'zerado' ? (
                            <span className="bg-red-600 text-white font-condensed font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                              🔴 JÁ ZERADO!
                            </span>
                          ) : item.status === 'risco_alto' ? (
                            <span className="bg-orange-500 text-white font-condensed font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                              🟠 ZERA EM ~{item.diasRestantes} DIAS
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 font-condensed font-bold text-[10px] px-1.5 py-0.5 rounded uppercase inline-block">
                              🟡 {item.diasRestantes} DIAS RESTANTES
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle Data Grid */}
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded border border-slate-200 text-center text-xs">
                        {/* Current Stock */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Estoque Atual</span>
                          <span className={`font-mono font-bold text-sm mt-0.5 ${
                            item.estoqueAtual <= 0 ? 'text-red-700 font-black' : 'text-slate-900'
                          }`}>
                            {item.estoqueAtual.toFixed(0)} {item.unidade}
                          </span>
                        </div>

                        {/* Monthly Sales Velocity with quick stepper */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Venda Média</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => onUpdateProductSalesRate(item.id, Math.max(1, item.vendaMensal - 1))}
                              className="w-5 h-5 bg-slate-200 rounded flex items-center justify-center font-bold text-slate-700 hover:bg-slate-300"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {item.vendaMensal}/mês
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateProductSalesRate(item.id, item.vendaMensal + 1)}
                              className="w-5 h-5 bg-slate-200 rounded flex items-center justify-center font-bold text-slate-700 hover:bg-slate-300"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Suggested Replenishment */}
                        <div className="flex flex-col items-center bg-emerald-100/60 rounded py-0.5 border border-emerald-300">
                          <span className="text-[10px] text-emerald-800 uppercase font-bold">Pedir Compra</span>
                          <span className="font-mono font-black text-emerald-900 text-sm mt-0.5">
                            +{item.sugestaoCompra} {item.unidade}
                          </span>
                        </div>
                      </div>

                      {/* Prices & Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                        <div className="text-xs">
                          <span className="text-slate-500 text-[10px] block">Preço Varejo / Atacado:</span>
                          <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.precoVarejo)}</span>
                          <span className="text-[10px] text-slate-500 ml-1">({formatCurrency(item.precoAtacado)})</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Eye / WhatsApp Photo */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPhoto(item);
                            }}
                            className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded border border-slate-300 text-slate-700 active:scale-95 transition-all cursor-pointer"
                            title="Ver foto e encaminhar no WhatsApp"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Quick Entrada */}
                          {entradaInputProduct?.id === item.id ? (
                            <div className="flex items-center gap-1 bg-emerald-50 p-1 rounded border border-emerald-300">
                              <input
                                type="number"
                                min="1"
                                autoFocus
                                value={entradaInputProduct.qtd}
                                onChange={(e) => setEntradaInputProduct({ id: item.id, qtd: parseInt(e.target.value) || 1 })}
                                className="w-12 text-center bg-white border border-emerald-400 rounded py-0.5 font-bold font-mono text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyEntrada(item, entradaInputProduct.qtd)}
                                className="bg-[#003816] text-white px-2 py-1 rounded text-xs font-bold font-condensed"
                              >
                                OK
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEntradaInputProduct({ id: item.id, qtd: item.sugestaoCompra || 10 })}
                              className="bg-[#00702b] hover:bg-[#008a35] text-white px-2.5 py-1.5 rounded text-xs font-bold font-condensed flex items-center gap-1 shadow-xs"
                            >
                              <ArrowUpCircle size={14} />
                              <span>+ Entrada</span>
                            </button>
                          )}

                          {/* Add to queue */}
                          <button
                            type="button"
                            onClick={() => onAddItemToQueue(item, item.sugestaoCompra || 1)}
                            className="bg-slate-200 hover:bg-emerald-100 text-slate-800 px-2 py-1.5 rounded text-xs font-bold font-condensed flex items-center gap-1 border border-slate-300"
                          >
                            <Plus size={13} />
                            <span>Fila</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                {/* 2. MODO DESKTOP: TABELA COMPLETA (hidden md:block) */}
                <div className="hidden md:block bg-white rounded-lg border border-slate-300 shadow-xs overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs select-none">
                    <thead>
                      <tr className="bg-[#003816] text-white font-condensed font-bold uppercase text-[11px] sticky top-0 z-10 whitespace-nowrap">
                        <th className="py-2 px-2.5 border-r border-emerald-900/60">CÓD.</th>
                        <th className="py-2 px-3 border-r border-emerald-900/60 min-w-[240px]">DESCRIÇÃO DO PRODUTO</th>
                        <th className="py-2 px-2 border-r border-emerald-900/60 text-center">MEDIDA</th>
                        <th className="py-2 px-2.5 border-r border-emerald-900/60 text-right">ESTOQUE ATUAL</th>
                        <th className="py-2 px-2.5 border-r border-emerald-900/60 text-center bg-[#00240e]">
                          VENDA MÉDIA MENSAL
                        </th>
                        <th className="py-2 px-3 border-r border-emerald-900/60 text-center">PREVISÃO P/ ZERAR</th>
                        <th className="py-2 px-2.5 border-r border-emerald-900/60 text-center text-amber-200 font-bold">
                          SUGESTÃO COMPRA
                        </th>
                        <th className="py-2 px-2.5 border-r border-emerald-900/60 text-right">PREÇO VAREJO</th>
                        <th className="py-2 px-2 border-r border-emerald-900/60 text-center">FOTO</th>
                        <th className="py-2 px-2.5 text-center">AÇÕES DE REPOSIÇÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans">
                      {filteredList.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-amber-50/60 whitespace-nowrap transition-colors ${
                            item.status === 'zerado' ? 'bg-red-50/50' : item.status === 'risco_alto' ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-900">{item.codigoInterno}</td>
                          <td className="py-2 px-3">
                            <div className="font-condensed font-bold uppercase text-slate-900 text-sm">
                              {item.descricao}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span className="font-mono">EAN: {item.codigoBarras}</span>
                              <span>•</span>
                              <span>Marca: {item.marcaRefer}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-800 bg-slate-50">
                            {item.medida || '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-sm">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                item.estoqueAtual <= 0
                                  ? 'bg-red-600 text-white animate-pulse'
                                  : item.estoqueAtual <= 5
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {formatQuantity(item.estoqueAtual)} {item.unidade}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                              <input
                                type="number"
                                min="1"
                                value={item.vendaMensal}
                                onChange={(e) => onUpdateProductSalesRate(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-10 text-center bg-transparent font-bold font-mono text-xs focus:bg-white focus:outline-none"
                                title="Editar média mensal de saída"
                              />
                              <span className="text-[11px] text-slate-600 font-condensed">un/mês</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.status === 'zerado' ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded font-condensed font-bold text-xs uppercase">
                                <AlertTriangle size={13} />
                                <span>JÁ ZERADO / RUPTURA!</span>
                              </span>
                            ) : item.status === 'risco_alto' ? (
                              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-900 border border-orange-300 px-2 py-0.5 rounded font-condensed font-bold text-xs uppercase">
                                <Clock size={13} />
                                <span>Vai zerar em ~{item.diasRestantes} dias!</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-condensed font-semibold text-xs uppercase">
                                <span>Resta ~{item.diasRestantes} dias</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-bold text-emerald-800 bg-emerald-50/60">
                            +{item.sugestaoCompra} {item.unidade}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-800">
                            {formatCurrency(item.precoVarejo)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPhoto(item);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-emerald-700 hover:text-white rounded text-emerald-800 transition-colors cursor-pointer"
                              title="Ver foto e encaminhar no WhatsApp"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {entradaInputProduct?.id === item.id ? (
                                <div className="flex items-center gap-1 bg-emerald-50 p-1 rounded border border-emerald-300">
                                  <input
                                    type="number"
                                    min="1"
                                    autoFocus
                                    value={entradaInputProduct.qtd}
                                    onChange={(e) => setEntradaInputProduct({ id: item.id, qtd: parseInt(e.target.value) || 1 })}
                                    className="w-12 text-center bg-white border border-emerald-400 rounded py-0.5 font-bold font-mono text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleApplyEntrada(item, entradaInputProduct.qtd)}
                                    className="bg-[#003816] text-white px-2 py-0.5 rounded text-xs font-bold font-condensed"
                                  >
                                    OK
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEntradaInputProduct(null)}
                                    className="text-slate-400 hover:text-slate-700 text-xs px-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEntradaInputProduct({ id: item.id, qtd: item.sugestaoCompra || 10 })}
                                  className="bg-[#00702b] hover:bg-[#008a35] text-white px-2 py-1 rounded text-xs font-bold font-condensed flex items-center gap-1 shadow-xs transition-colors"
                                  title="Dar entrada no estoque deste item agora"
                                >
                                  <ArrowUpCircle size={14} />
                                  <span>+ Entrada</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onAddItemToQueue(item, item.sugestaoCompra || 1)}
                                className="bg-slate-200 hover:bg-emerald-100 text-slate-800 hover:text-emerald-900 px-2 py-1 rounded text-xs font-bold font-condensed flex items-center gap-1 transition-colors border border-slate-300"
                                title="Adicionar à lista de conferência da tela principal"
                              >
                                <Plus size={13} />
                                <span>Adicionar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

          </div>

        </div>

        {/* Sticky Modal Footer */}
        <div className="bg-slate-100 px-4 py-2.5 sm:py-3 border-t border-slate-300 flex items-center justify-between shrink-0 z-20">
          <div className="text-xs text-slate-600 truncate">
            <strong>{filteredList.length}</strong> itens exibidos.
          </div>
          <button
            onClick={onClose}
            className="bg-[#003816] hover:bg-emerald-800 text-white font-condensed font-bold text-xs py-1.5 sm:py-2 px-4 sm:px-5 rounded uppercase tracking-wider shadow-sm transition-colors"
          >
            Fechar Painel (Esc)
          </button>
        </div>

      </div>
    </div>
  );
};
