import React, { useState } from 'react';
import { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  X,
  Download,
  Copy,
  Check,
  MessageSquare,
  Tag,
  Ruler,
  Boxes,
  Image as ImageIcon,
  Pencil
} from 'lucide-react';

interface ProductPhotoModalProps {
  product: Product | null;
  onClose: () => void;
  onEditProduct?: (product: Product) => void;
}

export const ProductPhotoModal: React.FC<ProductPhotoModalProps> = ({
  product,
  onClose,
  onEditProduct
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedPhoto, setCopiedPhoto] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [priceDisplayMode, setPriceDisplayMode] = useState<'both' | 'varejo' | 'atacado'>('both');
  const [customNote, setCustomNote] = useState('Produto disponível!');

  if (!product) return null;

  // Mensagem para o WhatsApp SEM estoque atual em loja
  const getRawWhatsAppText = () => {
    const lines: string[] = [
      `*${product.descricao}*`,
      product.medida ? `📏 *Medida:* ${product.medida}` : '',
      product.marcaRefer ? `🏷️ *Marca:* ${product.marcaRefer}` : '',
      `🔢 *Código:* ${product.codigoInterno}`,
    ];

    if (priceDisplayMode === 'both' || priceDisplayMode === 'varejo') {
      lines.push(`💰 *Preço Varejo:* ${formatCurrency(product.precoVarejo)}`);
    }
    if (priceDisplayMode === 'both' || priceDisplayMode === 'atacado') {
      lines.push(`🏷️ *Preço Atacado:* ${formatCurrency(product.precoAtacado)}`);
    }

    if (customNote.trim()) {
      lines.push('');
      lines.push(`💬 ${customNote.trim()}`);
    }

    return lines.filter((line, idx, arr) => {
      if (line === '' && arr[idx - 1] === '') return false;
      return line !== '' || idx > 0;
    }).join('\n');
  };

  // Convert product.fotoUrl to clean PNG Blob (without any text overlay) for sharing/copying
  const getCleanImageBlob = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 800;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create image blob'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load product image'));
      img.src = product.fotoUrl;
    });
  };

  // Encaminhar no WhatsApp com a foto normal + informações (sem estoque atual)
  const handleSendWhatsApp = async () => {
    const rawText = getRawWhatsAppText();
    setShareFeedback(null);

    // 1. Tenta usar Web Share API com arquivo de imagem (ideal no celular -> abre WhatsApp com foto + texto)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        const blob = await getCleanImageBlob();
        const cleanName = product.descricao.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const file = new File([blob], `${cleanName}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: product.descricao,
            text: rawText,
          });
          return;
        }
      } catch (err) {
        // Se usuário cancelou o compartilhamento nativo, não abre fallback à força
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // 2. Fallback (desktop / navegadores sem suporte a anexo via Web Share):
    // Copia a foto limpa para a área de transferência (para Ctrl+V no WhatsApp Web) e abre o WhatsApp com o texto
    try {
      if (navigator.clipboard && 'ClipboardItem' in window) {
        const blob = await getCleanImageBlob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShareFeedback('Foto copiada! No WhatsApp Web, pressione Ctrl+V para colar a foto junto da mensagem.');
      }
    } catch {
      setShareFeedback('Use "Baixar Foto" para anexar a imagem manualmente junto ao texto no WhatsApp.');
    }

    const url = `https://wa.me/?text=${encodeURIComponent(rawText)}`;
    window.open(url, '_blank');
  };

  const handleCopyPhoto = async () => {
    try {
      const blob = await getCleanImageBlob();
      if (navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedPhoto(true);
        setShareFeedback('Foto normal copiada! Cole (Ctrl+V) direto na conversa do WhatsApp.');
        setTimeout(() => setCopiedPhoto(false), 2500);
      } else {
        handleDownloadImage();
      }
    } catch {
      handleDownloadImage();
    }
  };

  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const blob = await getCleanImageBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = product.descricao.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      a.download = `FOTO_${cleanName}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback direto pela url da foto
      const a = document.createElement('a');
      a.href = product.fotoUrl;
      a.download = `FOTO_${product.codigoInterno}.png`;
      a.click();
    } finally {
      setTimeout(() => setDownloading(false), 500);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getRawWhatsAppText());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-100">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">

        {/* Header Bar */}
        <div className="bg-[#003816] px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-emerald-900/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="bg-emerald-700 text-white text-xs px-2 py-0.5 rounded font-mono font-bold shrink-0">
              CÓD: {product.codigoInterno}
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight font-condensed uppercase truncate text-white">
              {product.descricao}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEditProduct && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                className="bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 px-2.5 py-1 rounded text-xs font-bold font-condensed uppercase flex items-center gap-1 transition-colors"
                title="Alterar foto ou dados no cadastro"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Trocar Foto / Editar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              title="Fechar (Esc)"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/70">

          {/* Left Column: Foto Normal Cadastrada (sem nenhuma escrita em cima) */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon size={14} className="text-emerald-400" />
                <span>Foto Cadastrada do Item</span>
              </span>
              <span className="text-[11px] text-slate-500">Foto original sem escrita</span>
            </div>

            <div className="w-full bg-white rounded-lg overflow-hidden border border-slate-700 shadow-xl flex items-center justify-center min-h-[280px] sm:min-h-[360px] max-h-[460px] p-3">
              {product.fotoUrl ? (
                <img
                  src={product.fotoUrl}
                  alt={product.descricao}
                  className="max-w-full max-h-[420px] object-contain"
                />
              ) : (
                <div className="text-slate-400 text-sm text-center py-12">
                  Nenhuma foto cadastrada para este produto.
                </div>
              )}
            </div>

            {/* Ações diretas da foto limpa */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyPhoto}
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-3 rounded flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-700"
              >
                {copiedPhoto ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                <span>{copiedPhoto ? 'Foto Copiada!' : 'Copiar Foto Normal'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={downloading}
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-3 rounded flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-700"
              >
                <Download size={15} />
                <span>{downloading ? 'Baixando...' : 'Baixar Foto Normal'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Informações do Item & Encaminhamento no WhatsApp */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">

            {/* Dados principais */}
            <div className="space-y-3 bg-slate-900/90 border border-slate-800 p-4 rounded-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-condensed">
                Informações do Produto
              </h3>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/50">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Ruler size={13} className="text-sky-400" /> Medida / Especificação
                  </div>
                  <div className="font-bold text-white text-base mt-0.5 font-condensed">
                    {product.medida || 'Não informada'}
                  </div>
                </div>

                {/* Estoque exibido apenas para controle interno (não vai no WhatsApp) */}
                <div className="bg-slate-800/40 p-2.5 rounded border border-slate-700/40">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Boxes size={13} className="text-slate-400" /> Estoque Interno (Não enviado)
                  </div>
                  <div className={`font-bold text-base mt-0.5 font-condensed ${product.estoqueAtual > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {product.estoqueAtual.toFixed(0)} {product.unidade}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/50">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Tag size={13} className="text-emerald-400" /> Preço Varejo
                  </div>
                  <div className="font-bold text-emerald-300 text-lg font-condensed">
                    {formatCurrency(product.precoVarejo)}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/50">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Tag size={13} className="text-sky-400" /> Preço Atacado
                  </div>
                  <div className="font-bold text-sky-300 text-lg font-condensed">
                    {formatCurrency(product.precoAtacado)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-300 pt-1 border-t border-slate-800 space-y-1">
                <p><span className="text-slate-400">Marca:</span> <strong className="text-white">{product.marcaRefer}</strong></p>
                <p><span className="text-slate-400">Código:</span> <span className="font-mono text-slate-200">{product.codigoInterno}</span> <span className="text-slate-500">• EAN: {product.codigoBarras}</span></p>
              </div>
            </div>

            {/* Opções do que encaminhar no WhatsApp */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-300">
                  Preços na Mensagem do WhatsApp
                </label>
                <span className="text-[10px] text-emerald-400 font-medium">
                  Estoque da loja oculto no envio
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setPriceDisplayMode('both')}
                  className={`py-1.5 px-2 rounded font-medium transition-colors ${priceDisplayMode === 'both' ? 'bg-emerald-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Varejo + Atacado
                </button>
                <button
                  type="button"
                  onClick={() => setPriceDisplayMode('varejo')}
                  className={`py-1.5 px-2 rounded font-medium transition-colors ${priceDisplayMode === 'varejo' ? 'bg-emerald-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Só Varejo
                </button>
                <button
                  type="button"
                  onClick={() => setPriceDisplayMode('atacado')}
                  className={`py-1.5 px-2 rounded font-medium transition-colors ${priceDisplayMode === 'atacado' ? 'bg-sky-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Só Atacado
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Observação na mensagem:
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: Produto disponível!"
                />
              </div>

              {/* Prévia do texto */}
              <div className="bg-slate-950 border border-slate-800 rounded p-2.5 text-[11px] font-mono text-slate-300 whitespace-pre-line leading-relaxed max-h-32 overflow-y-auto">
                {getRawWhatsAppText()}
              </div>
            </div>

            {shareFeedback && (
              <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-3 py-2 rounded text-xs">
                {shareFeedback}
              </div>
            )}

            {/* Botões de Envio */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] font-condensed text-lg tracking-wide"
              >
                <MessageSquare size={20} className="fill-slate-950 stroke-none" />
                <span>ENCAMINHAR NO WHATSAPP (FOTO + INFORMAÇÕES)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-3 rounded flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-700"
              >
                {copiedText ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                <span>{copiedText ? 'Texto Copiado!' : 'Copiar Apenas Texto das Informações'}</span>
              </button>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 shrink-0">
          <span>Pressione <strong>ESC</strong> para fechar este painel.</span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded transition-colors font-medium"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
