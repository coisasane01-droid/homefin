import React, { useEffect, useRef, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { QUICK_MENU_ACTIONS, QuickMenuItemId } from './quickMenuConfig';

interface QuickMenuProps {
  enabled: boolean;
  items: string[];
  hidden: boolean;
  onOpenMenu: () => void;
  onNewAccount: () => void;
}

const QuickMenu: React.FC<QuickMenuProps> = ({
  enabled,
  items,
  hidden,
  onOpenMenu,
  onNewAccount,
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
    .map((id) => QUICK_MENU_ACTIONS.find((item) => item.id === id))
    .filter((item): item is (typeof QUICK_MENU_ACTIONS)[number] => Boolean(item));

  const activate = (id: QuickMenuItemId) => {
    setIsOpen(false);
    if (id === 'open-menu') {
      onOpenMenu();
    } else if (id === 'new-account') {
      onNewAccount();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-40 print:hidden"
      style={{
        right: 'max(env(safe-area-inset-right, 0px), 1rem)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
      }}
    >
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-3 w-56 origin-bottom-right animate-[quickMenuIn_160ms_ease-out] rounded-2xl border border-white/50 bg-white/75 p-2 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/80">
          {visibleActions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => activate(id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-white/70 dark:text-gray-100 dark:hover:bg-gray-700/70"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                <Icon size={18} />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={isOpen ? 'Fechar acesso rápido' : 'Abrir acesso rápido'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/65 text-primary-700 shadow-lg shadow-slate-900/15 backdrop-blur-xl transition duration-200 hover:scale-105 hover:bg-white/85 active:scale-95 dark:border-white/15 dark:bg-gray-800/65 dark:text-primary-300 dark:hover:bg-gray-800/90"
      >
        {isOpen ? <X size={23} /> : <Zap size={23} />}
      </button>
      <style>{`
        @keyframes quickMenuIn {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default QuickMenu;
