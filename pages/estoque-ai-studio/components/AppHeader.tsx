import React from 'react';
import { PackagePlus, History, Star, Table, Users, Lock, Share2 } from 'lucide-react';
import { StockWorkspace } from '../types';

interface AppHeaderProps {
  onOpenListaProdutos: () => void;
  onOpenCadastro: () => void;
  onOpenFavoritos: () => void;
  onOpenHistorico: () => void;
  onOpenGerenciarEstoques: () => void;
  totalProductsCount: number;
  workspaces: StockWorkspace[];
  activeWorkspace: StockWorkspace;
  onSelectWorkspace: (estoqueId: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenListaProdutos,
  onOpenCadastro,
  onOpenFavoritos,
  onOpenHistorico,
  onOpenGerenciarEstoques,
  totalProductsCount,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
}) => {
  const isShared = activeWorkspace?.tipo === 'compartilhado';

  return (
    <header className="bg-[#003816] text-white border-b-2 border-[#00240e] shadow-md select-none">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 flex flex-col gap-2.5">
        {/* Top Row: Title (NO LOGO) + Global Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Header Title - NO LOGO */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className="font-condensed font-extrabold text-xl sm:text-2xl tracking-wider text-white uppercase">
                CONTROLE DE ESTOQUE
              </span>
              <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-emerald-300 uppercase font-medium mt-0.5 flex-wrap">
                <span>HOMEFIN • {activeWorkspace?.nome || 'ESTOQUE'}</span>
                <span className="hidden sm:inline text-emerald-400/60">•</span>
                <span className="lowercase tracking-normal text-emerald-200/90 font-sans italic">
                  {totalProductsCount} itens • {isShared ? 'Compartilhado entre famílias' : 'Privado (só meu)'}
                </span>
              </div>
            </div>
          </div>

          {/* Global Action / Shortcut Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenListaProdutos}
              className="bg-[#004d20] hover:bg-[#00662a] active:bg-[#002e13] border border-emerald-500/40 text-white px-3 py-1.5 rounded text-xs font-bold font-condensed tracking-wide flex items-center gap-1.5 transition-all shadow-xs"
              title="Abrir estoque completo (Atalho: F12)"
            >
              <Table size={15} className="text-emerald-300" />
              <span>ESTOQUE COMPLETO (F12)</span>
            </button>

            <button
              type="button"
              onClick={onOpenCadastro}
              className="bg-[#004d20] hover:bg-[#00662a] active:bg-[#002e13] border border-emerald-500/40 text-white px-3 py-1.5 rounded text-xs font-bold font-condensed tracking-wide flex items-center gap-1.5 transition-all shadow-xs"
              title="Cadastrar novo produto no estoque"
            >
              <PackagePlus size={15} className="text-emerald-300" />
              <span>+ CADASTRAR PRODUTO</span>
            </button>

            <button
              type="button"
              onClick={onOpenFavoritos}
              className="bg-[#004d20] hover:bg-[#00662a] active:bg-[#002e13] border border-emerald-500/40 text-white px-3 py-1.5 rounded text-xs font-bold font-condensed tracking-wide flex items-center gap-1.5 transition-all shadow-xs"
              title="Ver produtos favoritos (F11)"
            >
              <Star size={14} className="text-amber-300 fill-amber-300/30" />
              <span>FAVORITOS (F11)</span>
            </button>

            <button
              type="button"
              onClick={onOpenHistorico}
              className="bg-[#004d20] hover:bg-[#00662a] active:bg-[#002e13] border border-emerald-500/40 text-white px-3 py-1.5 rounded text-xs font-bold font-condensed tracking-wide flex items-center gap-1.5 transition-all shadow-xs"
              title="Ver histórico de baixas e entradas de estoque"
            >
              <History size={14} className="text-emerald-300" />
              <span>HISTÓRICO</span>
            </button>
          </div>
        </div>

        {/* Bottom Strip: 1-Click Switcher between Shared Family Stock & Separate Private Stock */}
        <div className="bg-[#002810] border border-emerald-800/70 rounded px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-condensed font-bold uppercase tracking-wider text-emerald-300/90 mr-1">
              Entrar no Estoque:
            </span>
            {workspaces.map((ws) => {
              const selected = ws.id === activeWorkspace?.id;
              const shared = ws.tipo === 'compartilhado';
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => onSelectWorkspace(ws.id)}
                  className={`px-2.5 py-1 rounded text-xs font-condensed font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all border ${
                    selected
                      ? 'bg-white text-[#003816] border-white shadow-xs'
                      : 'bg-[#00421b] hover:bg-[#005825] text-emerald-100 border-emerald-700/60'
                  }`}
                  title={
                    shared
                      ? `Estoque compartilhado (${ws.membros.length} famílias)`
                      : 'Estoque privado (sem compartilhar)'
                  }
                >
                  {shared ? (
                    <Users size={13} className={selected ? 'text-[#00702b]' : 'text-emerald-300'} />
                  ) : (
                    <Lock size={13} className={selected ? 'text-slate-700' : 'text-amber-300'} />
                  )}
                  <span>{ws.nome}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenGerenciarEstoques}
            className="bg-[#00662a] hover:bg-[#007a33] border border-emerald-400/50 text-white px-2.5 py-1 rounded text-[11px] font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Share2 size={13} className="text-emerald-200" />
            <span>Compartilhar / Criar Estoque</span>
          </button>
        </div>
      </div>
    </header>
  );
};
