import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Home } from 'lucide-react';

export const notFoundCopy = {
  de: {
    title: 'Seite nicht gefunden',
    heading: 'Da bist du falsch abgebogen.',
    description: 'Diese Seite gibt es leider nicht oder sie wurde verschoben. Auf der Startseite und bei unseren Terminen geht’s weiter.',
    home: 'Zur Startseite',
    events: 'Termine entdecken',
    contact: 'Du brauchst Hilfe? Schreib uns.',
    privacy: 'Datenschutz',
    legal: 'Impressum',
  },
  en: {
    title: 'Page not found',
    heading: 'Looks like a wrong turn.',
    description: 'This page doesn’t exist or has moved. Head back to our homepage or explore our upcoming events.',
    home: 'Back to home',
    events: 'Explore events',
    contact: 'Need a hand? Get in touch.',
    privacy: 'Privacy',
    legal: 'Legal notice',
  },
};

export default function NotFoundContent({ locale }: { locale: string }) {
  const language = locale === 'en' ? 'en' : 'de';
  const copy = notFoundCopy[language];
  const prefix = language === 'en' ? '/en' : '';

  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-[1280px] px-4 sm:px-8 lg:px-16 pt-32 pb-16 sm:pb-24">
      <div className="grid items-center gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
        <div aria-hidden="true" className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-border-subtle bg-canvas-light px-4 py-8 sm:p-10 lg:order-last lg:py-20">
          <div className="absolute inset-6 rounded-full border border-accent-green/10" />
          <div className="relative flex items-center justify-center gap-1 text-accent-green">
            <span className="font-display text-[6rem] leading-none font-black sm:text-[8rem]">4</span>
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-base-light sm:h-40 sm:w-40">
              <Image src="/maennchen.svg" alt="" width={241} height={205} unoptimized className="h-auto w-28 sm:w-36" />
            </div>
            <span className="font-display text-[6rem] leading-none font-black sm:text-[8rem]">4</span>
          </div>
          <p className="relative mt-6 text-center text-xs font-bold tracking-[0.2em] text-accent-green">MAURER EVENTS</p>
        </div>

        <div className="min-w-0 text-center lg:text-left">
          <p className="mb-4 text-sm font-bold text-accent-green">404 · {copy.title}</p>
          <h1 id="not-found-title" className="font-display text-4xl font-black leading-[1.1] tracking-tight text-base-dark sm:text-5xl lg:text-6xl">
            {copy.heading}
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-base-dark/70 lg:mx-0 sm:text-lg">{copy.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href={`${prefix}/`} prefetch={false} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-green px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-base-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">
              <Home aria-hidden="true" className="h-4 w-4 shrink-0" />
              {copy.home}
            </Link>
            <Link href={`${prefix}/termine`} prefetch={false} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-accent-green px-6 py-3 text-sm font-bold text-accent-green transition-colors hover:bg-canvas-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">
              <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
              {copy.events}
            </Link>
          </div>

          <Link href={`${prefix}/#contact`} prefetch={false} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-base-dark/70 underline underline-offset-4 hover:text-accent-green focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">
            {copy.contact}
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
