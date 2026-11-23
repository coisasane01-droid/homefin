import React, { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { QUICK_MENU_ACTIONS } from './quickMenuConfig';

interface QuickMenuProps {
  enabled: boolean;
  items: { id: string; display: 'both' | 'label' | 'icon' }[];
  hidden: boolean;
  onOpenMenu: () => void;
  onNewAccount: () => void;
  onNavigate: (path: string) => void;
}

const QuickMenu: React.FC<QuickMenuProps> = ({
  enabled,
  items,
  hidden,
  onOpenMenu,
  onNewAccount,
  onNavigate,
}) => {
  const [hasBlockingOverlay, setHasBlockingOverlay] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const updateBlockingOverlay = () => {
      setHasBlockingOverlay(
        Boolean(document.querySelector('[role="dialog"], .fixed.inset-0'))
      );
    };

    updateBlockingOverlay();
    const observer = new MutationObserver(updateBlockingOverlay);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'role'],
    });

    return () => observer.disconnect();
  }, []);

  if (!enabled || hidden || hasBlockingOverlay) return null;

  const visibleActions = items
    .map((item) => {
      const option = QUICK_MENU_ACTIONS.find((action) => action.id === item.id);
      return option ? { ...option, display: item.display } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  // Até quatro atalhos configurados ficam visíveis; com mais itens,
  // mostramos três e mantemos o acesso ao menu completo.
  const primaryActions = visibleActions.length > 4
    ? visibleActions.slice(0, 3)
    : visibleActions;

  const activate = (item: (typeof primaryActions)[number]) => {
    if (item.action === 'open-menu') onOpenMenu();
    else if (item.action === 'new-account') onNewAccount();
    else if (item.path) onNavigate(item.path);
  };

  return (
    <div
      ref={menuRef}
      className="fixed bottom-0 left-1/2 z-40 w-[min(94vw,27rem)] -translate-x-1/2 pb-[calc(env(safe-area-inset-bottom,0px)+0.65rem)] md:hidden print:hidden"
    >
      <nav
        aria-label="Navegação rápida"
        className="relative flex items-stretch gap-1 overflow-hidden rounded-[1.8rem] border border-white/75 bg-white/70 p-2 shadow-[0_12px_36px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/70 dark:shadow-[0_12px_36px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.12)]"
        style={{
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          backdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
        />
        {primaryActions.map(({ id, label, icon: Icon, display, ...action }) => {
          const active = Boolean(action.path && location.pathname === action.path);
          return (
            <button
              key={id}
              type="button"
              onClick={() => activate({ id, label, icon: Icon, display, ...action })}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 transition-all duration-200 active:scale-95 ${
                active
                  ? 'bg-primary-500/10 text-primary-700 dark:bg-primary-400/15 dark:text-primary-200'
                  : 'text-slate-600 hover:bg-white/45 dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
              <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
                {label}
              </span>
              {active && (
                <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary-500 dark:bg-primary-300" />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu completo"
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-slate-600 transition-all duration-200 hover:bg-white/45 active:scale-95 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Menu size={20} strokeWidth={1.9} />
          <span className="text-[10px] font-semibold leading-tight">Mais</span>
        </button>
      </nav>
    </div>
  );
};

export default QuickMenu;
