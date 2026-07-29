"use client";

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const nextLocale = locale === 'de' ? 'en' : 'de';

  const toggleLocale = () => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale, scroll: false });
    });
  };

  return (
    <button
      onClick={toggleLocale}
      disabled={isPending}
      className="group flex items-center justify-center w-10 h-10 bg-canvas-light hover:bg-white border-2 border-border-light hover:border-accent-green rounded-full shadow-sm transition-all duration-300 disabled:opacity-50"
      aria-label={locale === 'de' ? "Switch to English" : "Auf Deutsch wechseln"}
      title={locale === 'de' ? "English" : "Deutsch"}
    >
      {locale === 'de' ? (
        // Show UK flag to switch to English
        <svg viewBox="0 0 60 30" className="w-5 h-3.5 rounded-[2px] object-cover shadow-sm group-hover:scale-110 transition-transform duration-300">
          <clipPath id="uk-flag">
            <path d="M0,0 v30 h60 v-30 z"/>
          </clipPath>
          <clipPath id="uk-cross">
            <path d="M30,15 h30 v15 z v-15 h-30 z h-30 v-15 z v15 h30 z"/>
          </clipPath>
          <g clipPath="url(#uk-flag)">
            <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-cross)" stroke="#C8102E" strokeWidth="4"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
          </g>
        </svg>
      ) : (
        // Show German flag to switch to German
        <svg viewBox="0 0 640 480" className="w-5 h-3.5 rounded-[2px] object-cover shadow-sm group-hover:scale-110 transition-transform duration-300">
          <path fill="#ffce00" d="M0 320h640v160H0z"/>
          <path d="M0 0h640v160H0z"/>
          <path fill="#dd0000" d="M0 160h640v160H0z"/>
        </svg>
      )}
    </button>
  );
}
