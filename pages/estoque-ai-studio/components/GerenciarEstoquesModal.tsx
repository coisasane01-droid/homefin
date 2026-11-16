import React, { useState } from 'react';
import {
  HomefinFamilyIdentity,
  StockType,
  StockWorkspace,
} from '../types';
import {
  X,
  Users,
  Lock,
  PlusCircle,
  KeyRound,
  Copy,
  Check,
  Share2,
  LogIn,
  Database,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import { DEFAULT_FAMILIES } from '../services/stockStorageService';

interface GerenciarEstoquesModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: StockWorkspace[];
  activeWorkspaceId: string;
  activeFamily: HomefinFamilyIdentity;
  isSupabaseConnected: boolean;
  isExternalHomefinInjected: boolean;
  onSelectWorkspace: (estoqueId: string) => void;
  onCreateWorkspace: (params: {
    nome: string;
    tipo: StockType;
    seedInitialProducts: boolean;
  }) => Promise<void> | void;
  onJoinByCode: (codigo: string) => Promise<{ ok: boolean; message: string }>;
  onDeleteWorkspace: (estoqueId: string) => void;
  onSwitchDemoFamily: (family: HomefinFamilyIdentity) => void;
  onCopySqlSchema: () => void;
}

export const GerenciarEstoquesModal: React.FC<GerenciarEstoquesModalProps> = ({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  activeFamily,
  isSupabaseConnected,
  isExternalHomefinInjected,
  onSelectWorkspace,
  onCreateWorkspace,
  onJoinByCode,
  onDeleteWorkspace,
  onSwitchDemoFamily,
  onCopySqlSchema,
}) => {
  const [activeTab, setActiveTab] = useState<'estoques' | 'criar_entrar' | 'homefin'>('estoques');
  const [newNome, setNewNome] = useState('');
  const [newTipo, setNewTipo] = useState<StockType>('privado');
  const [seedInitial, setSeedInitial] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinFeedback, setJoinFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen) return null;

  const handleCopyShareCode = (ws: StockWorkspace) => {
    if (!ws.codigoCompartilhamento) return;
    navigator.clipboard.writeText(ws.codigoCompartilhamento);
    setCopiedCodeId(ws.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleShareWhatsApp = (ws: StockWorkspace) => {
    if (!ws.codigoCompartilhamento) return;
    const text =
      `Olá! Estou compartilhando o estoque *"${ws.nome}"* no *HOMEFIN* com sua família.\n\n` +
      `Para acessarmos o mesmo estoque juntos:\n` +
      `1. Abra a página de Estoque no HOMEFIN\n` +
      `2. Clique em *Gerenciar / Compartilhar* -> *Entrar com Código*\n` +
      `3. Digite o código: *${ws.codigoCompartilhamento}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim()) return;
    await onCreateWorkspace({
      nome: newNome.trim(),
      tipo: newTipo,
      seedInitialProducts: seedInitial,
    });
    setNewNome('');
    setSeedInitial(false);
    setActiveTab('estoques');
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const res = await onJoinByCode(joinCode.trim());
    setJoinFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      setJoinCode('');
      setTimeout(() => {
        setJoinFeedback(null);
        setActiveTab('estoques');
      }, 900);
    }
  };

  const reactIntegrationSnippet = `import EstoqueHomefinPage from './pages/Estoque';
import { supabase } from './lib/supabase';

// Na rota /estoque do seu HOMEFIN:
<EstoqueHomefinPage
  supabaseClient={supabase}
  homefinUserId={session.user.id}
  homefinFamilyId={familiaAtual.id}
  homefinFamilyName={familiaAtual.nome}
/>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(reactIntegrationSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full border-2 border-[#003816] flex flex-col max-h-[92dvh] overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="bg-[#003816] text-white px-4 sm:px-5 py-3 flex items-center justify-between border-b border-emerald-950 shrink-0">
          <div>
            <h2 className="font-condensed font-extrabold text-lg sm:text-xl uppercase tracking-wider flex items-center gap-2">
              <Users size={20} className="text-emerald-300 shrink-0" />
              <span>Estoques HOMEFIN — Compartilhado & Privado</span>
            </h2>
            <p className="text-[11px] text-emerald-200/90 mt-0.5">
              Família ativa: <strong className="text-white">{activeFamily.familyName}</strong>
              {' • '}
              <span>{isSupabaseConnected ? 'Sincronizado com Supabase' : 'Modo Local (Pronto para HOMEFIN)'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-emerald-200 p-1 rounded"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-300 px-3 sm:px-5 pt-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('estoques')}
            className={`px-3.5 py-2 rounded-t font-condensed font-bold text-xs sm:text-sm uppercase tracking-wide border border-b-0 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'estoques'
                ? 'bg-white text-[#003816] border-slate-300'
                : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>Meus Estoques ({workspaces.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('criar_entrar')}
            className={`px-3.5 py-2 rounded-t font-condensed font-bold text-xs sm:text-sm uppercase tracking-wide border border-b-0 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'criar_entrar'
                ? 'bg-white text-[#003816] border-slate-300'
                : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200'
            }`}
          >
            <PlusCircle size={14} />
            <span>Criar / Entrar com Código</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('homefin')}
            className={`px-3.5 py-2 rounded-t font-condensed font-bold text-xs sm:text-sm uppercase tracking-wide border border-b-0 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'homefin'
                ? 'bg-white text-[#003816] border-slate-300'
                : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200'
            }`}
          >
            <Database size={14} />
            <span>Integração HOMEFIN & Teste Famílias</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'estoques' && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-950">
                Você pode ter <strong>estoques compartilhados</strong> (que aparecem iguais para a sua família e para a outra família HOMEFIN) e <strong>estoques separados privados</strong> (sem compartilhar, só seus) e alternar entre os dois a qualquer momento.
              </div>

              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const isShared = ws.tipo === 'compartilhado';

                return (
                  <div
                    key={ws.id}
                    className={`rounded-lg border-2 p-3.5 transition-all ${
                      isActive
                        ? 'border-[#003816] bg-emerald-50/40 shadow-sm'
                        : 'border-slate-300 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-condensed font-extrabold text-base sm:text-lg uppercase text-slate-900">
                            {ws.nome}
                          </span>
                          {isShared ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold uppercase font-condensed">
                              <Users size={12} />
                              <span>Compartilhado ({ws.membros.length} famílias)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[11px] font-bold uppercase font-condensed">
                              <Lock size={12} />
                              <span>Privado (Sem Compartilhar)</span>
                            </span>
                          )}
                          {isActive && (
                            <span className="bg-[#003816] text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              Aberto Agora
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Dono: <strong>{ws.ownerFamilyName}</strong>
                          </span>
                          {isShared && ws.membros.length > 0 && (
                            <span>
                              Famílias com acesso:{' '}
                              <strong>{ws.membros.map((m) => m.familyName).join(' • ')}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectWorkspace(ws.id);
                              onClose();
                            }}
                            className="bg-[#003816] hover:bg-[#004d20] text-white font-condensed font-bold uppercase text-xs px-3.5 py-2 rounded flex items-center gap-1.5 shadow-xs"
                          >
                            <LogIn size={14} />
                            <span>Entrar neste Estoque</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onClose}
                            className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-condensed font-bold uppercase text-xs px-3 py-2 rounded"
                          >
                            Você está aqui
                          </button>
                        )}

                        {workspaces.length > 1 && ws.ownerFamilyId === activeFamily.familyId && (
                          confirmDeleteId === ws.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteWorkspace(ws.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1.5 rounded"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(ws.id)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200"
                              title="Excluir este estoque"
                            >
                              <Trash2 size={15} />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Share code strip for shared workspaces */}
                    {isShared && ws.codigoCompartilhamento && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Código p/ outra família HOMEFIN:</span>
                          <code className="bg-slate-900 text-emerald-300 font-mono font-bold px-2.5 py-1 rounded text-xs tracking-wider">
                            {ws.codigoCompartilhamento}
                          </code>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyShareCode(ws)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1"
                          >
                            {copiedCodeId === ws.id ? (
                              <>
                                <Check size={13} className="text-emerald-700" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copiar Código</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(ws)}
                            className="bg-[#00702b] hover:bg-[#008a35] text-white text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1"
                          >
                            <Share2 size={13} />
                            <span>Convidar no WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'criar_entrar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Create new stock */}
              <form
                onSubmit={handleCreateSubmit}
                className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50 space-y-3"
              >
                <h3 className="font-condensed font-extrabold text-base uppercase text-[#003816] flex items-center gap-1.5">
                  <PlusCircle size={17} />
                  <span>Criar Novo Estoque</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nome do Estoque
                  </label>
                  <input
                    type="text"
                    required
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Ex: Meu Estoque Particular ou Loja 2"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003816]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-bold uppercase text-slate-700">
                    Tipo de Acesso
                  </span>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded border-2 cursor-pointer transition-colors ${
                      newTipo === 'privado'
                        ? 'border-[#003816] bg-white'
                        : 'border-slate-200 bg-white/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoEstoque"
                      checked={newTipo === 'privado'}
                      onChange={() => setNewTipo('privado')}
                      className="mt-1 accent-[#003816]"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <Lock size={12} /> Estoque Privado (Sem Compartilhar)
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Separado só para você. Nenhuma outra família HOMEFIN consegue ver.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded border-2 cursor-pointer transition-colors ${
                      newTipo === 'compartilhado'
                        ? 'border-[#003816] bg-white'
                        : 'border-slate-200 bg-white/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoEstoque"
                      checked={newTipo === 'compartilhado'}
                      onChange={() => setNewTipo('compartilhado')}
                      className="mt-1 accent-[#003816]"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <Users size={12} /> Compartilhado com Outra Família HOMEFIN
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Gera um código de convite para que os dois vejam e movimentem o mesmo estoque.
                      </p>
                    </div>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedInitial}
                    onChange={(e) => setSeedInitial(e.target.checked)}
                    className="accent-[#003816]"
                  />
                  <span>Preencher com itens iniciais de exemplo (opcional)</span>
                </label>

                <button
                  type="submit"
                  className="w-full bg-[#003816] hover:bg-[#004d20] text-white font-condensed font-bold uppercase text-sm py-2.5 rounded shadow-sm transition-colors"
                >
                  Criar e Entrar no Estoque
                </button>
              </form>

              {/* Join another family's stock by code */}
              <form
                onSubmit={handleJoinSubmit}
                className="border-2 border-slate-300 rounded-lg p-4 bg-white space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <h3 className="font-condensed font-extrabold text-base uppercase text-[#003816] flex items-center gap-1.5">
                    <KeyRound size={17} />
                    <span>Entrar em Estoque de Outra Família</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Recebeu um código de compartilhamento de outra família do HOMEFIN? Cole abaixo para vincular o mesmo estoque à sua conta e enxergar os mesmos produtos.
                  </p>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Código de Compartilhamento
                    </label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Ex: HF-FAM-4821"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm font-mono uppercase font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-[#003816]"
                    />
                  </div>

                  {joinFeedback && (
                    <div
                      className={`p-2.5 rounded text-xs font-semibold ${
                        joinFeedback.ok
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      {joinFeedback.text}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#00702b] hover:bg-[#008a35] text-white font-condensed font-bold uppercase text-sm py-2.5 rounded shadow-sm transition-colors"
                >
                  Vincular & Acessar Estoque
                </button>
              </form>
            </div>
          )}

          {activeTab === 'homefin' && (
            <div className="space-y-4">
              {/* Multi-family quick simulator when running standalone */}
              {!isExternalHomefinInjected && (
                <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="font-condensed font-extrabold text-sm uppercase text-amber-950">
                        Testar Visão entre Duas Famílias HOMEFIN (Modo Demonstração)
                      </h4>
                      <p className="text-xs text-amber-900">
                        Troque de família abaixo para conferir na prática: o <strong>Estoque Compartilhado</strong> aparece igual para as duas famílias, enquanto o <strong>Estoque Privado</strong> fica oculto para a outra família.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEFAULT_FAMILIES.map((fam) => {
                      const selected = fam.familyId === activeFamily.familyId;
                      return (
                        <button
                          key={fam.familyId}
                          type="button"
                          onClick={() => onSwitchDemoFamily(fam)}
                          className={`p-2.5 rounded border-2 text-left text-xs transition-all ${
                            selected
                              ? 'border-[#003816] bg-white shadow-xs'
                              : 'border-amber-200 bg-white/70 hover:bg-white'
                          }`}
                        >
                          <div className="font-bold text-slate-900 flex items-center justify-between">
                            <span>{fam.familyName}</span>
                            {selected && (
                              <span className="text-[10px] bg-[#003816] text-white px-1.5 py-0.5 rounded uppercase">
                                Ativa
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            family_id: {fam.familyId}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Supabase & GitHub/Vercel integration instructions */}
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-condensed font-extrabold text-sm uppercase text-[#003816]">
                      Integração com seu HOMEFIN (GitHub + Vercel + Supabase)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Status atual:{' '}
                      <strong className={isSupabaseConnected ? 'text-emerald-700' : 'text-amber-700'}>
                        {isSupabaseConnected
                          ? 'Conectado ao Supabase (Realtime ativo)'
                          : 'Modo Local (configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel ou passe supabaseClient via props)'}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onCopySqlSchema}
                    className="bg-[#003816] hover:bg-[#004d20] text-white text-xs font-condensed font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1.5"
                  >
                    <Database size={14} />
                    <span>Copiar SQL do Supabase</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="bg-slate-900 text-emerald-200 text-[11px] font-mono p-3 rounded overflow-x-auto leading-relaxed">
                    {reactIntegrationSnippet}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 border border-slate-600"
                  >
                    {copiedSnippet ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedSnippet ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <p>
                    • <strong>Passo 1 (Supabase):</strong> Execute o arquivo{' '}
                    <code className="bg-slate-200 px-1 rounded">supabase/homefin_estoque_schema.sql</code>{' '}
                    no SQL Editor do seu projeto Supabase (cria as tabelas{' '}
                    <code className="bg-slate-200 px-1 rounded">homefin_estoques</code>,{' '}
                    <code className="bg-slate-200 px-1 rounded">homefin_estoque_membros</code>,{' '}
                    <code className="bg-slate-200 px-1 rounded">homefin_estoque_produtos</code> e{' '}
                    <code className="bg-slate-200 px-1 rounded">homefin_estoque_movimentacoes</code> com RLS).
                  </p>
                  <p>
                    • <strong>Passo 2 (Vercel / .env):</strong> Mantenha{' '}
                    <code className="bg-slate-200 px-1 rounded">VITE_SUPABASE_URL</code> e{' '}
                    <code className="bg-slate-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> configurados ou passe a instância do{' '}
                    <code className="bg-slate-200 px-1 rounded">supabaseClient</code> já autenticada pelo HOMEFIN.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-4 sm:px-5 py-3 border-t border-slate-300 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#003816] hover:bg-emerald-800 text-white font-condensed font-bold text-xs py-2 px-5 rounded uppercase tracking-wider"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
