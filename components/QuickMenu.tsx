import React, { useEffect, useRef, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { QUICK_MENU_ACTIONS, QuickMenuItem } from './quickMenuConfig';

interface QuickMenuProps {
  enabled: boolean;
  items: QuickMenuItem[];
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
  const [isOpen, setIsOpen] = useState(false);
  const [hasBlockingOverlay, setHasBlockingOverlay] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (hidden || hasBlockingOverlay) setIsOpen(false);
  }, [hidden, hasBlockingOverlay]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!enabled || hidden || hasBlockingOverlay || items.length === 0) return null;

  const visibleActions = items
    .map((item) => {
      const option = QUICK_MENU_ACTIONS.find((action) => action.id === item.id);
      return option ? { ...option, display: item.display } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const activate = (itemId: string) => {
    setIsOpen(false);
    const item = QUICK_MENU_ACTIONS.find((option) => option.id === itemId);
    if (!item) return;
    if (item.action === 'open-menu') onOpenMenu();
    else if (item.action === 'new-account') onNewAccount();
    else if (item.path) onNavigate(item.path);
  };

  return (
    <div
      ref={menuRef}
      className="fixed left-1/2 z-40 -translate-x-1/2 print:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
    >
      {isOpen && (
        <div
          className="absolute bottom-full left-1/2 mb-3 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 origin-bottom animate-[quickMenuIn_160ms_ease-out] overflow-y-auto rounded-2xl border border-white/50 bg-white/70 p-2 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl dark:border-white/20 dark:bg-gray-900/65"
          style={{ maxHeight: 'min(60vh, 32rem)' }}
        >
          {visibleActions.map(({ id, label, icon: Icon, display }) => (
            <button
              key={id}
              type="button"
              onClick={() => activate(id)}
              aria-label={display === 'icon' ? label : undefined}
              className={`flex min-h-12 w-full items-center rounded-xl text-sm font-semibold text-gray-800 transition-colors hover:bg-white/50 dark:text-gray-100 dark:hover:bg-white/10 ${
                display === 'icon' ? 'justify-center px-3' : 'gap-3 px-3'
              }`}
            >
              {display !== 'label' && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-300">
                  <Icon size={19} />
                </span>
              )}
              {display !== 'icon' && <span className="truncate">{label}</span>}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={isOpen ? 'Fechar acesso rápido' : 'Abrir acesso rápido'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-[66px] w-[66px] items-center justify-center overflow-hidden rounded-full border border-white/70 text-primary-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),inset_0_-2px_8px_rgba(255,255,255,0.12),0_12px_30px_rgba(15,23,42,0.22)] backdrop-blur-[22px] transition duration-200 hover:scale-105 active:scale-95 dark:border-white/30 dark:text-primary-200"
        style={{
          background: 'rgba(255, 255, 255, 0.22)',
          backdropFilter: 'blur(22px) saturate(180%)',
          WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[1px] rounded-full bg-gradient-to-br from-white/75 via-white/10 to-transparent opacity-70"
        />
        <span className="relative">
          {isOpen ? <X size={25} /> : <Zap size={25} />}
        </span>
      </button>
      <style>{`
        @keyframes quickMenuIn {
          from { opacity: 0; transform: translate(-50%, 6px) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default QuickMenu;
