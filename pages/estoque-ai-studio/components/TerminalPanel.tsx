import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { formatCurrency, formatNumberDecimal, parseBrNumber } from '../utils/formatters';
import { Eye, ArrowDownCircle, ArrowUpCircle, Check, Search, Sparkles } from 'lucide-react';

interface TerminalPanelProps {
  products: Product[];
  onOpenListaProdutos: () => void;
  onOpenFavoritos: () => void;
  onOpenPhoto: (product: Product) => void;
  onAddItemToQueue: (item: {
    product: Product;
    quantity: number;
    price: number;
    tipoPreco: 'varejo' | 'atacado';
    desconto: number;
    tipoDesconto: 'valor' | 'porcentagem';
    valorTotal: number;
  }) => void;
  onQuickBaixa: (product: Product, quantity: number) => void;
  onQuickEntrada: (product: Product, quantity: number) => void;
  mobileSlot?: React.ReactNode;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  products,
  onOpenListaProdutos,
  onOpenFavoritos,
  onOpenPhoto,
  onAddItemToQueue,
  onQuickBaixa,
  onQuickEntrada,
  mobileSlot
}) => {
  const [codigoInput, setCodigoInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [quantidade, setQuantidade] = useState<string>('1');
  const [valorUnit, setValorUnit] = useState<string>('0,00');
  const [tipoPreco, setTipoPreco] = useState<'varejo' | 'atacado'>('varejo');
  const [desconto, setDesconto] = useState<string>('0,00');
  const [tipoDesconto, setTipoDesconto] = useState<'valor' | 'porcentagem'>('valor');
  const [valorTotal, setValorTotal] = useState<number>(0);

  // Autocomplete / "aba para ver o disponível"
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownActiveIndex, setDropdownActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeInputType, setActiveInputType] = useState<'codigo' | 'descricao'>('codigo');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Initialize with matching default product if available
  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      const initial = products.find(
        (p) => p.codigoBarras === '207315005' || p.codigoInterno === '548'
      ) || products[0];
      if (initial) {
        setSelectedProduct(initial);
        setCodigoInput(initial.codigoBarras || initial.codigoInterno);
        setDescricaoInput(initial.descricao);
        setValorUnit(formatNumberDecimal(initial.precoVarejo));
      }
    }
  }, [products, selectedProduct]);

  // Recalculate Valor Total
  useEffect(() => {
    const qtdNum = parseBrNumber(quantidade) || 0;
    const unitNum = parseBrNumber(valorUnit) || 0;
    const descNum = parseBrNumber(desconto) || 0;

    const subtotal = qtdNum * unitNum;
    let finalDesc = 0;
    if (tipoDesconto === 'valor') {
      finalDesc = descNum;
    } else {
      finalDesc = subtotal * (descNum / 100);
    }

    const calculated = Math.max(0, subtotal - finalDesc);
    setValorTotal(calculated);
  }, [quantidade, valorUnit, desconto, tipoDesconto]);

  // Filter products for autocomplete dropdown
  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase().trim();
    if (activeInputType === 'codigo') {
      return (
        p.codigoInterno.toLowerCase().includes(query) ||
        p.codigoBarras.toLowerCase().includes(query) ||
        p.descricao.toLowerCase().includes(query)
      );
    } else {
      return (
        p.descricao.toLowerCase().includes(query) ||
        p.medida.toLowerCase().includes(query) ||
        p.marcaRefer.toLowerCase().includes(query) ||
        p.codigoInterno.toLowerCase().includes(query)
      );
    }
  });

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setCodigoInput(p.codigoBarras || p.codigoInterno);
    setDescricaoInput(p.descricao);
    const priceToSet = tipoPreco === 'atacado' ? p.precoAtacado : p.precoVarejo;
    setValorUnit(formatNumberDecimal(priceToSet));
    setShowDropdown(false);

    // Also automatically add to items list below as requested:
    // "AO SELECIONAR ADICIONA PARA BAIXO"
    const qtdNum = parseBrNumber(quantidade) || 1;
    const unitNum = priceToSet;
    const descNum = parseBrNumber(desconto) || 0;
    const subtotal = qtdNum * unitNum;
    const total = tipoDesconto === 'valor' ? Math.max(0, subtotal - descNum) : Math.max(0, subtotal * (1 - descNum / 100));

    onAddItemToQueue({
      product: p,
      quantity: qtdNum,
      price: unitNum,
      tipoPreco: tipoPreco,
      desconto: descNum,
      tipoDesconto: tipoDesconto,
      valorTotal: total
    });
  };

  const handleTipoPrecoToggle = (newTipo: 'varejo' | 'atacado') => {
    setTipoPreco(newTipo);
    if (selectedProduct) {
      const price = newTipo === 'atacado' ? selectedProduct.precoAtacado : selectedProduct.precoVarejo;
      setValorUnit(formatNumberDecimal(price));
    }
  };

  // Handle Enter key or Adicionar Produto (ENTER) - Gives Baixa or adds to queue
  const handleConfirmAction = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;

    const qtdNum = parseBrNumber(quantidade) || 1;
    const unitNum = parseBrNumber(valorUnit) || selectedProduct.precoVarejo;
    const descNum = parseBrNumber(desconto) || 0;

    // Add to queue
    onAddItemToQueue({
      product: selectedProduct,
      quantity: qtdNum,
      price: unitNum,
      tipoPreco: tipoPreco,
      desconto: descNum,
      tipoDesconto: tipoDesconto,
      valorTotal: valorTotal
    });

    // "AO CLICAR EM ENTER DA BAIXA NO ESTOQUE NAS QUANTIDADES"
    onQuickBaixa(selectedProduct, qtdNum);
  };

  const handleDarEntradaOnly = () => {
    if (!selectedProduct) return;
    const qtdNum = parseBrNumber(quantidade) || 1;
    onQuickEntrada(selectedProduct, qtdNum);
  };

  return (
    <div className="bg-[#e5e9ec] p-3 sm:p-5 border-2 border-slate-300 rounded shadow-md relative select-none">

      {/* Top Banner inside Terminal - NO LOGO */}
      <div className="bg-[#003816] px-4 py-2.5 rounded-t -mt-3 -mx-3 sm:-mt-5 sm:-mx-5 mb-4 flex items-center justify-between border-b border-[#00240e]">
        <div className="flex items-center gap-2">
          <span className="font-condensed font-bold text-lg tracking-wider text-white uppercase">
            TERMINAL DE ESTOQUE
          </span>
        </div>

        <span className="bg-[#00521e] text-emerald-200 border border-emerald-500/40 text-[10px] font-condensed uppercase px-2 py-0.5 rounded font-bold">
          OPERACIONAL
        </span>
      </div>

      <form onSubmit={handleConfirmAction} className="space-y-3.5">

        {/* ROW 1: CÓDIGO & Produtos Favoritos (F11) */}
        <div className="space-y-1 relative">
          <div className="flex items-center justify-between">
            <label className="text-base font-extrabold uppercase font-condensed tracking-wide text-slate-900">
              CÓDIGO
            </label>
            <button
              type="button"
              onClick={onOpenFavoritos}
              className="bg-[#003816] hover:bg-[#004d20] active:bg-[#00240e] text-white text-xs font-bold font-condensed px-3 py-1 rounded-full transition-colors border border-emerald-900/50"
            >
              Produtos Favoritos (F11)
            </button>
          </div>

          <div className="flex items-stretch rounded border-2 border-slate-400 bg-white shadow-xs focus-within:border-[#003816] focus-within:ring-1 focus-within:ring-[#003816]">
            <div className="bg-[#003816] text-[#22c55e] text-xs font-bold font-mono px-3 flex items-center justify-center shrink-0 border-r border-[#00240e]">
              Auto:
            </div>
            <input
              type="text"
              value={codigoInput}
              onChange={(e) => {
                setCodigoInput(e.target.value);
                setSearchQuery(e.target.value);
                setActiveInputType('codigo');
                setShowDropdown(true);
              }}
              onFocus={() => {
                setSearchQuery(codigoInput);
                setActiveInputType('codigo');
                setShowDropdown(true);
              }}
              placeholder="Digite o código ou bipe o código de barras..."
              className="w-full px-3 py-1.5 text-lg font-bold font-mono text-slate-900 bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* ROW 2: DESCRIÇÃO PRODUTO & Tabela Produto (F12) */}
        <div className="space-y-1 relative">
          <div className="flex items-center justify-between">
            <label className="text-base font-extrabold uppercase font-condensed tracking-wide text-slate-900">
              DESCRIÇÃO PRODUTO
            </label>
            <button
              type="button"
              onClick={onOpenListaProdutos}
              className="bg-[#003816] hover:bg-[#004d20] active:bg-[#00240e] text-white text-xs font-bold font-condensed px-3 py-1 rounded-full transition-colors border border-emerald-900/50"
            >
              Tabela Produto (F12)
            </button>
          </div>

          <div className="flex items-stretch rounded border-2 border-slate-400 bg-white shadow-xs focus-within:border-[#003816]">
            <input
              type="text"
              value={descricaoInput}
              onChange={(e) => {
                setDescricaoInput(e.target.value);
                setSearchQuery(e.target.value);
                setActiveInputType('descricao');
                setShowDropdown(true);
              }}
              onFocus={() => {
                setSearchQuery(descricaoInput);
                setActiveInputType('descricao');
                setShowDropdown(true);
              }}
              placeholder="Digite para buscar e ver o estoque disponível..."
              className="w-full px-3 py-2 text-base font-bold font-condensed uppercase text-slate-800 bg-white focus:outline-none"
            />
            {selectedProduct && (
              <button
                type="button"
                onClick={() => onOpenPhoto(selectedProduct)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 border-l border-slate-300 flex items-center gap-1 text-xs font-bold font-condensed transition-colors"
                title="Ver foto e encaminhar no WhatsApp"
              >
                <Eye size={16} className="text-emerald-700" />
                <span className="hidden sm:inline">VER FOTO</span>
              </button>
            )}
          </div>

          {/* Autocomplete Aba flutuante ("AO ESCREVER ABRE ABA PARA VER O DISPONIVEL") */}
          {showDropdown && filteredProducts.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#003816] rounded shadow-2xl z-40 max-h-72 overflow-y-auto animate-in fade-in-50 duration-100"
            >
              <div className="bg-[#003816] text-white px-3 py-1.5 text-xs font-condensed font-bold uppercase flex items-center justify-between">
                <span>ESTOQUE DISPONÍVEL ({filteredProducts.length} itens encontrados)</span>
                <span className="text-[10px] text-emerald-200">Clique para selecionar e adicionar</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    onMouseEnter={() => setDropdownActiveIndex(idx)}
                    className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs ${
                      dropdownActiveIndex === idx ? 'bg-emerald-50 text-[#003816]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Photo thumbnail */}
                      <img
                        src={p.fotoUrl}
                        alt=""
                        className="w-10 h-10 object-contain bg-slate-100 rounded border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 font-condensed text-sm truncate uppercase">
                          {p.descricao}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono bg-slate-200 px-1 rounded text-slate-700">Cód: {p.codigoInterno}</span>
                          <span>Medida: <strong className="text-slate-700">{p.medida}</strong></span>
                          <span>Marca: {p.marcaRefer}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      {/* Available stock badge */}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Disponível</span>
                        <span
                          className={`font-condensed font-bold text-sm px-1.5 py-0.2 rounded ${
                            p.estoqueAtual > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.estoqueAtual.toFixed(0)} {p.unidade}
                        </span>
                      </div>

                      {/* Prices */}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Varejo / Atacado</span>
                        <div className="font-condensed font-bold text-sm text-slate-900">
                          {formatCurrency(p.precoVarejo)}
                          <span className="text-[11px] font-normal text-slate-500 ml-1">
                            ({formatCurrency(p.precoAtacado)})
                          </span>
                        </div>
                      </div>

                      {/* Photo Quick preview button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPhoto(p);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded transition-colors text-slate-600"
                        title="Ver foto e encaminhar no WhatsApp"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Product Quick Info Strip (Measure, Current Stock, Brand) */}
        {selectedProduct && (
          <div className="bg-emerald-50/80 border border-emerald-300 rounded p-2 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-3">
              <span>Medida: <strong className="font-bold text-slate-900">{selectedProduct.medida}</strong></span>
              <span>Marca: <strong className="font-semibold">{selectedProduct.marcaRefer}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Estoque Atual:</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                selectedProduct.estoqueAtual > 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {selectedProduct.estoqueAtual.toFixed(0)} {selectedProduct.unidade}
              </span>
            </div>
          </div>
        )}

        {/* ROW 3: QUANTIDADE x VALOR UNIT. - DESC. */}
        <div className="grid grid-cols-12 gap-2 items-end">

          {/* QUANTIDADE */}
          <div className="col-span-3 space-y-1">
            <label className="text-xs font-bold uppercase font-condensed tracking-wide text-slate-900 block">
              QUANTIDADE
            </label>
            <input
              type="number"
              step="any"
              min="0.001"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-full bg-white border-2 border-slate-400 rounded py-1.5 px-2 text-center text-lg font-bold font-mono text-slate-900 focus:outline-none focus:border-[#003816]"
            />
          </div>

          {/* Separator X */}
          <div className="col-span-1 flex items-center justify-center pb-2">
            <span className="font-bold text-xl text-blue-900 font-sans">X</span>
          </div>

          {/* VALOR UNIT. */}
          <div className="col-span-4 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase font-condensed tracking-wide text-slate-900">
                VALOR UNIT.
              </label>
              {/* Varejo / Atacado price picker */}
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleTipoPrecoToggle('varejo')}
                  className={`px-1.5 py-0.2 rounded font-bold uppercase transition-colors ${
                    tipoPreco === 'varejo' ? 'bg-[#003816] text-white' : 'bg-slate-300 text-slate-700'
                  }`}
                  title="Usar Preço Varejo"
                >
                  Var
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoPrecoToggle('atacado')}
                  className={`px-1.5 py-0.2 rounded font-bold uppercase transition-colors ${
                    tipoPreco === 'atacado' ? 'bg-[#003816] text-white' : 'bg-slate-300 text-slate-700'
                  }`}
                  title="Usar Preço Atacado"
                >
                  Atac
                </button>
              </div>
            </div>
            <input
              type="text"
              value={valorUnit}
              onChange={(e) => setValorUnit(e.target.value)}
              className="w-full bg-white border-2 border-slate-400 rounded py-1.5 px-2 text-center text-lg font-bold font-mono text-slate-900 focus:outline-none focus:border-[#003816]"
            />
          </div>

          {/* Separator - */}
          <div className="col-span-1 flex items-center justify-center pb-2">
            <span className="font-bold text-xl text-blue-900 font-sans">-</span>
          </div>

          {/* DESC. [VALOR v] */}
          <div className="col-span-3 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase font-condensed tracking-wide text-slate-900">
                DESC.
              </label>
              <select
                value={tipoDesconto}
                onChange={(e) => setTipoDesconto(e.target.value as 'valor' | 'porcentagem')}
                className="bg-white border border-slate-400 rounded text-[10px] font-bold px-1 py-0.2 text-slate-800"
              >
                <option value="valor">VALOR</option>
                <option value="porcentagem">%</option>
              </select>
            </div>
            <input
              type="text"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="w-full bg-white border-2 border-slate-400 rounded py-1.5 px-2 text-center text-lg font-bold font-mono text-slate-900 focus:outline-none focus:border-[#003816]"
            />
          </div>

        </div>

        {/* ROW 4: VALOR TOTAL (Para conferir preços) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-extrabold uppercase font-condensed tracking-wide text-slate-800">
              VALOR TOTAL (CONFERÊNCIA DE PREÇO)
            </label>
            <span className="text-[11px] text-slate-500 italic">
              Não finaliza venda fiscal
            </span>
          </div>
          <div className="bg-white border-2 border-slate-400 rounded py-2 px-3 text-center text-2xl font-black font-mono text-slate-950 shadow-inner">
            {formatNumberDecimal(valorTotal)}
          </div>
        </div>

        {/* ROW 5: BUTTONS - Adicionar Produto (ENTER) / Dar Baixa / Dar Entrada */}
        <div className="space-y-2 pt-1">
          {/* Main Action matching screenshot: "Adicionar Produto (ENTER)" */}
          <button
            type="submit"
            className="w-full bg-[#003816] hover:bg-[#004d20] active:bg-[#00240e] text-white text-lg font-black font-condensed py-2.5 px-4 rounded shadow-md tracking-wider transition-all flex items-center justify-center gap-2 border border-emerald-950"
          >
            <ArrowDownCircle size={20} className="text-emerald-400" />
            <span>Adicionar Produto (ENTER) / Dar Baixa</span>
          </button>

          {/* User specifically asked: "ADICIONAR BOTÃO DE DAR ENTRADA SÓ EM ITEM" */}
          <button
            type="button"
            onClick={handleDarEntradaOnly}
            className="w-full bg-[#005a22] hover:bg-[#00702b] active:bg-[#004419] text-white text-sm font-bold font-condensed py-2 px-4 rounded shadow-xs tracking-wide transition-all flex items-center justify-center gap-2 border border-emerald-700/60"
          >
            <ArrowUpCircle size={18} className="text-emerald-300" />
            <span>+ DAR ENTRADA NO ESTOQUE DESTE ITEM</span>
          </button>

          {/* MODO CELULAR: Exibição da fila de conferência e movimentação diretamente abaixo do botão de Dar Entrada */}
          {mobileSlot && (
            <div className="pt-3 block lg:hidden">
              {mobileSlot}
            </div>
          )}
        </div>

      </form>

      {/* Retro Status Display: Visível no desktop */}
      <div className="hidden lg:flex mt-8 pt-6 border-t-2 border-slate-300/80 flex-col items-center justify-center text-center">
        <div className="font-condensed font-black text-4xl sm:text-5xl tracking-wide leading-none text-[#00a843] drop-shadow-xs">
          ESTOQUE
        </div>
        <div className="font-condensed font-black text-4xl sm:text-5xl tracking-wide leading-none text-[#00a843] drop-shadow-xs mt-1">
          OPERACIONAL
        </div>
        <span className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mt-2">
          SISTEMA PRONTO PARA CONSULTA E BAIXA
        </span>
      </div>

    </div>
  );
};
