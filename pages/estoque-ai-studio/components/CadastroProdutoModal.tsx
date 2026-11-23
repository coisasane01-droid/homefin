import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { X, Upload, Save, AlertCircle, Camera, Check } from 'lucide-react';
import { homefinApiUrl } from '../../../services/nativeApi';
import { getFamilySessionToken } from '../../../services/familyAuth';

interface CadastroProdutoModalProps {
  onClose: () => void;
  onSaveProduct: (product: Product) => Promise<void>;
  productToEdit?: Product | null;
  nextCodigoInterno: string;
  familyId: string;
  existingProducts: Product[];
}

export const CadastroProdutoModal: React.FC<CadastroProdutoModalProps> = ({
  onClose,
  onSaveProduct,
  productToEdit,
  nextCodigoInterno,
  familyId,
  existingProducts,
}) => {
  const [codigoInterno, setCodigoInterno] = useState(productToEdit?.codigoInterno || nextCodigoInterno);
  const [codigoBarras, setCodigoBarras] = useState(productToEdit?.codigoBarras || '');
  const [descricao, setDescricao] = useState(productToEdit?.descricao || '');
  const [medida, setMedida] = useState(productToEdit?.medida || '');
  const [marcaRefer, setMarcaRefer] = useState(productToEdit?.marcaRefer || '');
  const [unidade, setUnidade] = useState(productToEdit?.unidade || 'UN');
  const [estoqueAtual, setEstoqueAtual] = useState<string>(
    productToEdit ? productToEdit.estoqueAtual.toString() : '0'
  );
  const [precoVarejo, setPrecoVarejo] = useState<string>(
    productToEdit ? productToEdit.precoVarejo.toString() : ''
  );
  const [precoAtacado, setPrecoAtacado] = useState<string>(
    productToEdit ? productToEdit.precoAtacado.toString() : ''
  );
  const [valorProm, setValorProm] = useState<string>(
    productToEdit ? (productToEdit.valorProm || 0).toString() : '0'
  );
  const [ncm, setNcm] = useState(productToEdit?.ncm || '');
  const [vendaMediaMensal, setVendaMediaMensal] = useState<string>(
    productToEdit?.vendaMediaMensal ? productToEdit.vendaMediaMensal.toString() : '0'
  );
  const [observacao, setObservacao] = useState(productToEdit?.observacao || '');
  const [fotoUrl, setFotoUrl] = useState(
    productToEdit?.fotoUrl || ''
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoSelectedType, setPhotoSelectedType] = useState<string>('preset');

  // Quick Preset Photo options
  const PRESET_PHOTOS = [
    { label: 'Pneu Radial Passeio', type: 'tire1', size: medida || '195/55R15' },
    { label: 'Pneu Camionete All-Terrain', type: 'tire2', size: medida || '265/70R16' },
    { label: 'Roda Esportiva', type: 'wheel', size: 'Aro 15 diamantada' },
    { label: 'Amortecedor / Suspensão', type: 'shock', size: 'Pressurizado' },
    { label: 'Óleo Lubrificante Motor', type: 'oil', size: '1 Litro' },
    { label: 'Filtro de Óleo / Ar', type: 'filter', size: 'Blindado' },
    { label: 'Bico Válvula TR414', type: 'valve', size: '49.1mm' }
  ];

  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [duplicateChecking, setDuplicateChecking] = useState(false);

  const normalizeDuplicateValue = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');

  const findLocalDuplicate = () => {
    const name = normalizeDuplicateValue(descricao);
    const sku = normalizeDuplicateValue(codigoInterno);
    const barcode = normalizeDuplicateValue(codigoBarras);
    return existingProducts.find(item => {
      if (item.id === productToEdit?.id) return false;
      return (name && normalizeDuplicateValue(item.descricao) === name) ||
        (sku && normalizeDuplicateValue(item.codigoInterno) === sku) ||
        (barcode && normalizeDuplicateValue(item.codigoBarras) === barcode);
    });
  };

  const checkRemoteDuplicate = async () => {
    if (!familyId || familyId === 'v1' || !descricao.trim()) return [];
    const token = await getFamilySessionToken(familyId);
    if (!token) throw new Error('Sua sessão expirou. Entre novamente para conferir duplicidade.');
    const response = await fetch(homefinApiUrl('/api/inventory'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: 'duplicate-check',
        familyId,
        product: {
          id: productToEdit?.id || '',
          name: descricao.trim(),
          sku: codigoInterno.trim(),
          barcode: codigoBarras.trim(),
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível conferir produtos duplicados.');
    return Array.isArray(data.duplicates) ? data.duplicates : [];
  };

  useEffect(() => {
    let cancelled = false;
    const localMatch = findLocalDuplicate();
    if (localMatch) {
      setDuplicateMessage(`ITEM JÁ CADASTRADO: ${localMatch.descricao} (código ${localMatch.codigoInterno}).`);
      setDuplicateChecking(false);
      return;
    }
    setDuplicateMessage('');
    if (descricao.trim().length < 3 && !codigoBarras.trim()) {
      setDuplicateChecking(false);
      return;
    }
    setDuplicateChecking(true);
    const timer = setTimeout(async () => {
      try {
        const duplicates = await checkRemoteDuplicate();
        if (cancelled) return;
        const match = duplicates[0];
        setDuplicateMessage(match
          ? `ITEM JÁ CADASTRADO: ${match.name} (código ${match.sku || 'não informado'}).`
          : '');
      } catch (error) {
        if (!cancelled) setDuplicateMessage(error instanceof Error ? error.message : 'Falha ao conferir duplicidade.');
      } finally {
        if (!cancelled) setDuplicateChecking(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [descricao, codigoInterno, codigoBarras, existingProducts, productToEdit?.id, familyId]);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione uma imagem válida.');
      return;
    }
    setProcessingPhoto(true);
    setErrorMsg('');
    try {
      const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        let width = image.width;
        let height = image.height;
        let result = '';
        for (let maxSide = 1600; maxSide >= 500 && !result; maxSide = Math.floor(maxSide * 0.75)) {
          const ratio = Math.min(1, maxSide / Math.max(width, height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * ratio));
          canvas.height = Math.max(1, Math.round(height * ratio));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Não foi possível processar a foto.');
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          for (const quality of [0.85, 0.72, 0.58, 0.42]) {
            const data = canvas.toDataURL('image/jpeg', quality);
            if (data.startsWith('data:image/jpeg;base64,') && data.length < 2_600_000) {
              result = data;
              break;
            }
          }
        }
        if (!result) throw new Error('Não foi possível reduzir a foto para menos de 2 MB.');
        setFotoUrl(result);
        setPhotoSelectedType('upload');

        const imageMatch = result.match(/^data:(image\/jpeg);base64,([A-Za-z0-9+/=]+)$/);
        if (!imageMatch) throw new Error('Não foi possível preparar a foto para reconhecimento.');
        const token = await getFamilySessionToken(familyId);
        if (!token) throw new Error('Sua sessão expirou. Entre novamente para usar o reconhecimento por foto.');
        const recognitionResponse = await fetch(homefinApiUrl('/api/inventory-recognize'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            familyId,
            imageBase64: imageMatch[2],
            mimeType: imageMatch[1],
          }),
        });
        const recognition = await recognitionResponse.json();
        if (!recognitionResponse.ok) {
          throw new Error(recognition.error || 'Não foi possível reconhecer os dados da foto.');
        }
        const identified = recognition.product || {};
        if (identified.name) setDescricao(identified.name);
        if (identified.sku) setCodigoInterno(current => current === nextCodigoInterno ? identified.sku : current);
        if (identified.barcode) setCodigoBarras(identified.barcode);
        if (identified.measure) setMedida(identified.measure);
        if (identified.supplier) setMarcaRefer(identified.supplier);
        if (identified.unit) setUnidade(identified.unit.toUpperCase());
        if (identified.ncm) setNcm(identified.ncm);
        if (identified.notes) setObservacao(identified.notes);
      } finally {
        image.close();
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Falha ao processar a foto.');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleSelectPreset = (presetName: string) => {
    // Generate inline SVG based on product
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <radialGradient id="tGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#242b35"/>
          <stop offset="70%" stop-color="#111518"/>
          <stop offset="100%" stop-color="#020304"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#f8fafc"/>
      <circle cx="200" cy="200" r="160" fill="url(#tGrad)"/>
      <circle cx="200" cy="200" r="142" fill="none" stroke="#334155" stroke-width="4" stroke-dasharray="12 8"/>
      <circle cx="200" cy="200" r="95" fill="#e2e8f0"/>
      <circle cx="200" cy="200" r="30" fill="#0f172a"/>
      <text x="200" y="80" fill="#f1f5f9" font-family="sans-serif" font-weight="900" font-size="14" text-anchor="middle">${(marcaRefer || 'PREMIUM').toUpperCase()}</text>
      <text x="200" y="340" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="middle">${medida || presetName}</text>
    </svg>`;
    setFotoUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    setPhotoSelectedType('preset');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || processingPhoto) return;
    if (!descricao.trim()) {
      setErrorMsg('Informe a descrição do produto.');
      return;
    }
    if (!codigoInterno.trim()) {
      setErrorMsg('Informe o código interno.');
      return;
    }

    const localDuplicate = findLocalDuplicate();
    if (localDuplicate) {
      setDuplicateMessage(`ITEM JÁ CADASTRADO: ${localDuplicate.descricao} (código ${localDuplicate.codigoInterno}).`);
      setErrorMsg('Este produto já está cadastrado. Confira o item existente antes de salvar.');
      return;
    }
    try {
      const duplicates = await checkRemoteDuplicate();
      if (duplicates.length) {
        const duplicate = duplicates[0];
        setDuplicateMessage(`ITEM JÁ CADASTRADO: ${duplicate.name} (código ${duplicate.sku || 'não informado'}).`);
        setErrorMsg('Este produto já está cadastrado neste estoque. O cadastro foi bloqueado.');
        return;
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Não foi possível validar duplicidade. Tente novamente.');
      return;
    }

    const varejoNum = parseFloat(precoVarejo.replace(',', '.')) || 0;
    const atacadoNum = parseFloat(precoAtacado.replace(',', '.')) || 0;
    const estoqueNum = parseFloat(estoqueAtual.replace(',', '.')) || 0;
    const promNum = parseFloat(valorProm.replace(',', '.')) || 0;

    // Fallback photo if none provided
    let finalPhoto = fotoUrl;
    if (!finalPhoto) {
      const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <rect width="400" height="400" fill="#f1f5f9"/>
        <circle cx="200" cy="180" r="80" fill="#003816" opacity="0.15"/>
        <text x="200" y="270" fill="#003816" font-family="sans-serif" font-weight="bold" font-size="16" text-anchor="middle">${descricao.substring(0, 24)}</text>
        <text x="200" y="300" fill="#64748b" font-family="sans-serif" font-size="13" text-anchor="middle">${medida || 'ESTOQUE'}</text>
      </svg>`;
      finalPhoto = `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;
    }

    const newProduct: Product = {
      id: productToEdit ? productToEdit.id : crypto.randomUUID(),
      codigoInterno: codigoInterno.trim(),
      codigoBarras: codigoBarras.trim() || codigoInterno.trim(),
      descricao: descricao.trim().toUpperCase(),
      medida: medida.trim().toUpperCase(),
      marcaRefer: marcaRefer.trim().toUpperCase() || 'GENÉRICA',
      unidade: unidade.trim().toUpperCase() || 'UN',
      estoqueAtual: estoqueNum,
      precoVarejo: varejoNum,
      precoAtacado: atacadoNum > 0 ? atacadoNum : varejoNum,
      valorProm: promNum,
      ncm: ncm.trim(),
      pesoBruto: 0,
      pesoLiquido: 0,
      vendaMediaMensal: parseInt(vendaMediaMensal, 10) || 0,
      observacao: observacao.trim(),
      fotoUrl: finalPhoto,
      favorito: productToEdit?.favorito || false
    };

    setSaving(true);
    setErrorMsg('');

    try {
      await onSaveProduct(newProduct);
      onClose();
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o produto.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-[#f0f2f5] text-slate-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-400">

        {/* Header */}
        <div className="bg-[#003816] text-white px-5 py-3.5 flex items-center justify-between border-b border-emerald-950">
          <div className="flex items-center gap-2">
            <span className="bg-[#00a843] w-3 h-3 rounded-xs inline-block"></span>
            <h2 className="text-xl font-bold tracking-tight font-condensed uppercase">
              {productToEdit ? 'Editar Produto Cadastrado' : 'Cadastro de Produto no Estoque'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded hover:bg-white/10"
            title="Fechar (Esc)"
          >
            <X size={22} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-6 space-y-5">
          {errorMsg && (
            <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-2.5 rounded text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}
          {duplicateChecking && <div className="text-xs text-slate-500">Conferindo se o produto já está cadastrado...</div>}
          {duplicateMessage && (
            <div className="bg-amber-100 border border-amber-400 text-amber-900 px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{duplicateMessage}</span>
            </div>
          )}

          {/* Section: Identificação */}
          <div className="bg-white p-4 rounded border border-slate-300 shadow-xs space-y-3">
            <div className="text-xs font-bold text-[#003816] uppercase font-condensed tracking-wider border-b pb-1">
              1. Identificação Básica do Produto
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Código Interno *
                </label>
                <input
                  type="text"
                  required
                  value={codigoInterno}
                  onChange={(e) => setCodigoInterno(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-sm font-mono font-bold focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Código de Barras / EAN
                </label>
                <input
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  placeholder="Ex: 7898403653830"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-sm font-mono focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Marca / Fabricante / Referência
                </label>
                <input
                  type="text"
                  value={marcaRefer}
                  onChange={(e) => setMarcaRefer(e.target.value)}
                  placeholder="Ex: SUNNY, HIFLY, NAKATA"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div className="md:col-span-8">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Descrição Completa do Produto *
                </label>
                <input
                  type="text"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: PNEU SUNNY 195/55R15 85V NP226"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-sm font-bold uppercase focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                  Medida / Dimensão *
                </label>
                <input
                  type="text"
                  value={medida}
                  onChange={(e) => setMedida(e.target.value)}
                  placeholder="Ex: 195/55R15 85V"
                  className="w-full bg-emerald-50 border border-emerald-300 rounded px-2.5 py-1.5 text-sm font-bold text-emerald-900 focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Preços e Estoque (Nota explícita: Varejo e Atacado) */}
          <div className="bg-white p-4 rounded border border-slate-300 shadow-xs space-y-3">
            <div className="text-xs font-bold text-[#003816] uppercase font-condensed tracking-wider border-b pb-1 flex items-center justify-between">
              <span>2. Estoque e Preços (Varejo e Atacado)</span>
              <span className="text-[11px] text-slate-500 font-normal">
                Conforme diretriz: sem cálculo de margem de venda, foco em conferência e estoque.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Estoque Atual (Qtd)
                </label>
                <input
                  type="number"
                  step="any"
                  value={estoqueAtual}
                  onChange={(e) => setEstoqueAtual(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-sm font-bold focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Unidade
                </label>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-sm font-bold focus:bg-white focus:border-[#003816] focus:outline-none"
                >
                  <option value="UN">UN (Unidade)</option>
                  <option value="PC">PC (Peça)</option>
                  <option value="JG">JG (Jogo)</option>
                  <option value="LT">LT (Litro)</option>
                  <option value="CX">CX (Caixa)</option>
                  <option value="KG">KG (Quilo)</option>
                </select>
              </div>

              <div className="bg-emerald-50/60 p-2 rounded border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-900 uppercase mb-1">
                  Preço Varejo (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={precoVarejo}
                  onChange={(e) => setPrecoVarejo(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-white border border-emerald-400 rounded px-2.5 py-1.5 text-sm font-bold text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="bg-sky-50/60 p-2 rounded border border-sky-200">
                <label className="block text-xs font-bold text-sky-900 uppercase mb-1">
                  Preço Atacado (R$)
                </label>
                <input
                  type="text"
                  value={precoAtacado}
                  onChange={(e) => setPrecoAtacado(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-white border border-sky-400 rounded px-2.5 py-1.5 text-sm font-bold text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs text-slate-600 uppercase mb-1">
                  Preço Promocional (Opcional)
                </label>
                <input
                  type="text"
                  value={valorProm}
                  onChange={(e) => setValorProm(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-sm focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-800 uppercase mb-1">
                  Venda Média Mensal (un/mês)
                </label>
                <input
                  type="number"
                  min="1"
                  value={vendaMediaMensal}
                  onChange={(e) => setVendaMediaMensal(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full bg-amber-50 border border-amber-300 rounded px-2.5 py-1 text-sm font-bold text-amber-950 focus:bg-white focus:border-[#003816] focus:outline-none"
                  title="Utilizado para prever quando o produto vai zerar"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 uppercase mb-1">
                  NCM
                </label>
                <input
                  type="text"
                  value={ncm}
                  onChange={(e) => setNcm(e.target.value)}
                  placeholder="40111000"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-sm focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 uppercase mb-1">
                  Observações Internas
                </label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Prateleira 4B, índice de carga..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-sm focus:bg-white focus:border-[#003816] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Foto Normal do Produto (para abrir no olho e encaminhar no WhatsApp) */}
          <div className="bg-white p-4 rounded border border-slate-300 shadow-xs space-y-3">
            <div className="text-xs font-bold text-[#003816] uppercase font-condensed tracking-wider border-b pb-1 flex flex-wrap items-center justify-between gap-2">
              <span>3. Foto do Produto (Exibida ao clicar no Olho 👁️)</span>
              <span className="text-xs text-slate-500 font-normal">Envie a foto normal do item para encaminhar junto no WhatsApp</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Preview image */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div className="w-40 h-40 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative shadow-inner">
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt="Preview do produto"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-3 text-slate-400">
                      <Camera size={32} className="mx-auto mb-1 opacity-50" />
                      <span className="text-xs">Sem foto cadastrada</span>
                    </div>
                  )}
                </div>
                {fotoUrl && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Check size={12} /> Foto carregada
                    </span>
                    <button
                      type="button"
                      onClick={() => setFotoUrl('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium"
                    >
                      Remover foto
                    </button>
                  </div>
                )}
              </div>

              {/* Upload & Presets */}
              <div className="md:col-span-8 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subir Foto Normal do Item (Galeria, Câmera ou Computador):
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 bg-[#003816] hover:bg-emerald-900 text-white text-xs font-bold py-2 px-4 rounded cursor-pointer transition-colors shadow-xs">
                      <Upload size={15} />
                      <span>Escolher Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-3 rounded cursor-pointer transition-colors shadow-xs sm:hidden">
                      <Camera size={15} />
                      <span>Tirar Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">Fotos são reduzidas automaticamente e analisadas pela IA para preencher os dados visíveis</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Ou selecione um ícone ilustrativo (opcional):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_PHOTOS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSelectPreset(preset.label)}
                        className="text-xs bg-slate-100 hover:bg-emerald-100 border border-slate-300 hover:border-emerald-500 rounded px-2.5 py-1 transition-colors text-slate-700 font-medium"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-300">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2 px-5 rounded text-sm transition-colors uppercase font-condensed"
            >
              Cancelar (Esc)
            </button>

            <button
              type="submit"
              disabled={saving || processingPhoto || duplicateChecking || Boolean(duplicateMessage)}
              className="bg-[#003816] hover:bg-[#004d20] text-white font-bold py-2.5 px-6 rounded text-sm flex items-center gap-2 transition-colors shadow uppercase font-condensed tracking-wide text-base"
            >
              <Save size={18} />
              <span>Salvar Produto no Estoque</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
