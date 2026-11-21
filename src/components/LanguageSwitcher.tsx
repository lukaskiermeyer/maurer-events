"use client";

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useEffect, useRef, useState, useTransition } from 'react';

const LOCALES = [
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'bar', label: 'Bayrisch', short: 'BAR' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

function Flag({ code, className }: { code: LocaleCode; className?: string }) {
  if (code === 'en') {
    return (
      <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
        <clipPath id="uk-flag">
          <path d="M0,0 v30 h60 v-30 z" />
        </clipPath>
        <clipPath id="uk-cross">
          <path d="M30,15 h30 v15 z v-15 h-30 z h-30 v-15 z v15 h30 z" />
        </clipPath>
        <g clipPath="url(#uk-flag)">
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-cross)" stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </g>
      </svg>
    );
  }
  if (code === 'bar') {
    // Bayerische Rautenflagge (weiß-blau) als Erkennungszeichen für Bairisch.
    return (
      <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
        <rect width="60" height="30" fill="#ffffff" />
        <g fill="#0065ae">
          <path d="M0 0 L7.5 7.5 L0 15 Z" />
          <path d="M0 15 L7.5 22.5 L0 30 Z" />
          <path d="M7.5 7.5 L15 0 L22.5 7.5 L15 15 Z" />
          <path d="M7.5 22.5 L15 15 L22.5 22.5 L15 30 Z" />
          <path d="M22.5 7.5 L30 0 L37.5 7.5 L30 15 Z" />
          <path d="M22.5 22.5 L30 15 L37.5 22.5 L30 30 Z" />
          <path d="M37.5 7.5 L45 0 L52.5 7.5 L45 15 Z" />
          <path d="M37.5 22.5 L45 15 L52.5 22.5 L45 30 Z" />
          <path d="M52.5 7.5 L60 0 L60 15 Z" />
          <path d="M52.5 22.5 L60 15 L60 30 Z" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 640 480" className={className} aria-hidden="true">
      <path fill="#ffce00" d="M0 320h640v160H0z" />
      <path d="M0 0h640v160H0z" />
      <path fill="#dd0000" d="M0 160h640v160H0z" />
    </svg>
  );
}

export default function LanguageSwitcher({ glass = false }: { glass?: boolean }) {
  const locale = useLocale() as LocaleCode;
  const t = useTranslations("Navbar");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const switchTo = (code: LocaleCode) => {
    setOpen(false);
    if (code === locale) return;
    startTransition(() => {
      router.replace(`${pathname}${window.location.search}`, { locale: code, scroll: false });
    });
  };

  const current = LOCALES.find(entry => entry.code === locale) ?? LOCALES[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(value => !value)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("change_language")} (${current.label})`}
        className={`group flex items-center gap-2 rounded-full transition-all duration-300 disabled:opacity-50 h-10 px-2.5 ${
          glass
            ? "bg-white/15 backdrop-blur-md border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_16px_rgba(0,0,0,0.18)] hover:bg-white/25 hover:border-white/55"
            : "bg-canvas-light hover:bg-white border-2 border-border-light hover:border-accent-green shadow-sm"
        }`}
      >
        <Flag code={current.code} className="w-5 h-3.5 rounded-[2px] object-cover shadow-sm group-hover:scale-110 transition-transform duration-300" />
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""} ${glass ? "text-white" : "text-base-dark"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Sprache"
          className="absolute right-0 mt-2 w-40 overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl z-50"
        >
          {LOCALES.map(entry => (
            <li key={entry.code}>
              <button
                type="button"
                role="option"
                aria-selected={entry.code === locale}
                onClick={() => switchTo(entry.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold transition-colors ${
                  entry.code === locale ? "bg-accent-green/10 text-accent-green" : "text-base-dark hover:bg-canvas-light"
                }`}
              >
                <Flag code={entry.code} className="w-5 h-3.5 rounded-[2px] object-cover shadow-sm" />
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
