import React, { useState } from 'react';
import { Share2, Copy, Check, ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Share: React.FC = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const shareUrl = window.location.origin;

  const shareMessage = `🏠 Conheça o HomeFin!

Organize as contas da sua casa, acompanhe seus gastos, metas, dívidas e muito mais em um só lugar.

Acesse o HomeFin:
${shareUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error('Erro ao copiar mensagem:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HomeFin',
          text: 'Conheça o HomeFin e organize as finanças da sua família!',
          url: shareUrl,
        });
      } catch (error) {
        console.log('Compartilhamento cancelado ou indisponível:', error);
      }
    } else {
      await handleCopy();
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">

          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <Share2
                  className="text-primary-600 dark:text-primary-400"
                  size={26}
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Compartilhar / Indicar
                </h1>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Convide sua família e amigos para conhecer o HomeFin.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 mb-6">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {shareMessage}
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
            >
              <Share2 size={20} />
              Compartilhar
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              {copied ? 'Mensagem copiada!' : 'Copiar mensagem'}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
              <Home size={16} />
              <span>HomeFin — Organização financeira familiar</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Share;