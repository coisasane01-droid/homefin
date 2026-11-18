import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';

const languages = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

function CountryFlag({ code }: { code: string }) {
  if (code === 'pt') {
    return (
      <svg viewBox="0 0 60 40" className="h-6 w-9 rounded-sm shadow-sm" aria-label="Brasil">
        <rect width="60" height="40" fill="#009739" />
        <path d="M30 4 L55 20 L30 36 L5 20 Z" fill="#FFDF00" />
        <circle cx="30" cy="20" r="10" fill="#002776" />
        <path d="M21 17 Q30 13 39 18" fill="none" stroke="white" strokeWidth="1.5" />
        <g fill="white">
          <circle cx="25" cy="17" r="0.8" />
          <circle cx="30" cy="14" r="0.8" />
          <circle cx="35" cy="18" r="0.8" />
          <circle cx="29" cy="23" r="0.8" />
          <circle cx="34" cy="24" r="0.8" />
        </g>
      </svg>
    );
  }

  if (code === 'en') {
    return (
      <svg viewBox="0 0 60 40" className="h-6 w-9 rounded-sm shadow-sm" aria-label="Estados Unidos">
        <rect width="60" height="40" fill="white" />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} y={i * 6.16} width="60" height="3.08" fill="#B22234" />
        ))}
        <rect width="26" height="21.6" fill="#3C3B6E" />
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={row % 2 === 0 ? 2.5 + col * 4 : 4.5 + col * 4}
              cy={2.5 + row * 4}
              r="0.75"
              fill="white"
            />
          ))
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 40" className="h-6 w-9 rounded-sm shadow-sm" aria-label="Espanha">
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
      <rect x="12" y="15" width="2" height="10" rx="0.5" fill="#AA151B" />
      <rect x="15" y="15" width="4" height="2" fill="#AA151B" />
      <path d="M14 18 L18 18 L18 24 L14 24 Z" fill="none" stroke="#AA151B" strokeWidth="1" />
    </svg>
  );
}

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0]
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const syncLanguage = (language: string) => {
      const code = language.split('-')[0];
      if (languages.some(item => item.code === code)) {
        setSelected(code);
      }
    };

    syncLanguage(i18n.resolvedLanguage || i18n.language);
    i18n.on('languageChanged', syncLanguage);

    return () => {
      i18n.off('languageChanged', syncLanguage);
    };
  }, [i18n]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    updatePosition();

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const changeLanguage = async (code: string) => {
    if (!languages.some(item => item.code === code)) return;

    setOpen(false);
    setSelected(code);
    localStorage.setItem('homefin_language', code);
    document.documentElement.lang = code;

    try {
      await i18n.changeLanguage(code);
    } catch (error) {
      console.error('HomeFin: erro ao trocar idioma:', error);
    }
  };

  const current =
    languages.find(item => item.code === selected) || languages[0];

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-label="Selecionar idioma"
          aria-expanded={open}
          aria-haspopup="true"
          className="flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-2 text-sm font-semibold text-current shadow-lg backdrop-blur-xl transition-all hover:bg-white/30 active:scale-95"
        >
          <CountryFlag code={current.code} />
          <ChevronDown size={15} />
        </button>
      </div>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Selecionar idioma"
          style={{
            position: 'fixed',
            top: position.top,
            right: position.right,
            zIndex: 2147483647,
          }}
          className="w-48 overflow-hidden rounded-2xl border border-white/30 bg-white p-1.5 text-slate-800 shadow-2xl"
        >
          {languages.map(language => (
            <button
              type="button"
              role="menuitem"
              key={language.code}
              aria-pressed={selected === language.code}
              onClick={() => void changeLanguage(language.code)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-slate-100 active:bg-slate-200"
            >
              <CountryFlag code={language.code} />

              <span className="flex-1 text-left font-medium">
                {language.label}
              </span>

              {selected === language.code && (
                <Check size={17} className="text-emerald-500" />
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
