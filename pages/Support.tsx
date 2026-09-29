import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, Send, Lock, User, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supportService, SupportMessage } from '../services/supportService';

const Support: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const familyId = localStorage.getItem('homefin_current_family_id') || 'v1';

  const notifySupportReply = (messageText: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification('Suporte HomeFin', {
        body: messageText || 'O suporte respondeu à sua mensagem.',
        icon: '/icons/icon-192.png',
      });
    }
  };

  const requestSupportNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não oferece suporte a notificações.');
      return;
    }

    if (Notification.permission === 'granted') {
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        new Notification('Notificações ativadas', {
          body: 'Você será avisado quando o suporte responder.',
          icon: '/icons/icon-192.png',
        });
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão para notificações:', error);
    }
  };

  const loadSupport = async () => {
    try {
      const [loadedMessages, settings] = await Promise.all([
        supportService.getMessages(familyId),
        supportService.getSupportSettings(familyId),
      ]);

      setMessages((currentMessages) => {
        if (currentMessages.length > 0 && loadedMessages.length > currentMessages.length) {
          const previousIds = new Set(currentMessages.map((item) => item.id));

          const newAdminMessage = loadedMessages.find(
            (item) =>
              item.sender_type === 'admin' && !previousIds.has(item.id)
          );

          if (newAdminMessage) {
            notifySupportReply(newAdminMessage.message);
          }
        }

        return loadedMessages;
      });

      setBlocked(settings.blocked);

      await supportService.markMessagesAsRead(familyId, 'admin');
    } catch (error) {
      console.error('Erro ao carregar suporte:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupport();

    const interval = window.setInterval(() => {
      loadSupport();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [familyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const cleanMessage = message.trim();

    if (!cleanMessage || sending || blocked) {
      return;
    }

    try {
      setSending(true);

      const newMessage = await supportService.sendMessage(
        familyId,
        cleanMessage,
        'family'
      );

      setMessages((current) => [...current, newMessage]);
      setMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar sua mensagem.';

      alert(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-[650px]">

          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <Headphones
                className="text-primary-600 dark:text-primary-400"
                size={24}
              />
            </div>

            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Suporte
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Converse com a equipe do HomeFin
              </p>
            </div>

            {typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission !== 'granted' && (
                <button
                  type="button"
                  onClick={requestSupportNotifications}
                  className="shrink-0 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  title="Ativar notificações do suporte"
                >
                  🔔 Ativar
                </button>
              )}
          </div>

          {blocked && (
            <div className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 p-4 flex items-start gap-3">
              <Lock
                size={20}
                className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
              />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Envio de mensagens bloqueado
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  O envio de mensagens está temporariamente bloqueado pelo administrador.
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 p-5 overflow-y-auto bg-gray-50 dark:bg-gray-900/30">
            {loading ? (
              <div className="h-full min-h-[400px] flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Carregando conversa...
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
                  <Headphones
                    size={30}
                    className="text-primary-600 dark:text-primary-400"
                  />
                </div>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Como podemos ajudar?
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                  Envie uma mensagem para falar com a equipe de suporte do HomeFin.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((item) => {
                  const isFamily = item.sender_type === 'family';

                  return (
                    <div
                      key={item.id}
                      className={`flex ${isFamily ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[70%] ${
                          isFamily ? 'items-end' : 'items-start'
                        } flex flex-col`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1">
                          {!isFamily && (
                            <ShieldCheck
                              size={14}
                              className="text-primary-600 dark:text-primary-400"
                            />
                          )}

                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {isFamily ? 'Você' : 'Suporte HomeFin'}
                          </span>
                        </div>

                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            isFamily
                              ? 'bg-primary-600 text-white rounded-br-md'
                              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {item.message}
                          </p>
                        </div>

                        <span className="text-[11px] text-gray-400 mt-1 px-1">
                          {new Date(item.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {blocked ? (
              <div className="rounded-xl bg-gray-100 dark:bg-gray-700/60 px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                Você pode visualizar o histórico da conversa, mas não pode enviar novas mensagens enquanto o bloqueio estiver ativo.
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    rows={2}
                    disabled={sending}
                    className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                  />

                  <p className="text-[11px] text-gray-400 mt-1 px-1">
                    Pressione Enter para enviar. Shift + Enter para quebrar linha.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="shrink-0 w-12 h-12 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
                  title="Enviar mensagem"
                >
                  <Send size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
          <User size={14} />
          <span>Suporte HomeFin</span>
        </div>
      </div>
    </div>
  );
};

export default Support;
