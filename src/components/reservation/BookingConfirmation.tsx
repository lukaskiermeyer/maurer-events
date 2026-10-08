"use client";

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Mail, QrCode, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import type { BookingConfirmationState } from '@/lib/booking-confirmation';

export default function BookingConfirmation({ state }: { state: BookingConfirmationState }) {
  const t = useTranslations('BookingConfirmation');
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (state === 'success') {
      try { sessionStorage.removeItem('reservation-checkout-attempt'); } catch { /* Storage is optional. */ }
    }
    if (state !== 'pending') return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      router.refresh();
      if (++attempts >= 12) window.clearInterval(interval);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [state, router]);

  const entrance = (delay: number) => ({
    initial: reduceMotion ? false as const : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay },
  });

  return (
    <section className="relative isolate overflow-hidden bg-base-light px-4 pb-20 pt-36 sm:px-8 md:pb-28 md:pt-44" aria-labelledby="booking-confirmation-title">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-48 -z-10 h-[600px] w-[600px] rounded-full bg-accent-green/5 blur-3xl" />
      <div className="mx-auto max-w-4xl">
        <motion.div {...entrance(0)} className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <div aria-hidden="true" className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
            {state === 'success' ? (
              <svg className="h-12 w-12" viewBox="0 0 48 48" fill="none">
                <motion.path
                  d="M10 25L20 35L38 13"
                  stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.2 }}
                />
              </svg>
            ) : state === 'pending' ? <RefreshCw className="h-10 w-10 motion-safe:animate-spin [animation-duration:3s]" /> : <Mail className="h-10 w-10" />}
          </div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-accent-green" role="status">
            {t(`${state}_label`)}
          </p>
          <h1 id="booking-confirmation-title" className="mb-5 text-5xl font-black uppercase tracking-tighter text-base-dark sm:text-6xl md:text-7xl">
            {t(`${state}_title`)}
          </h1>
          <p className="text-base leading-relaxed text-base-dark/65 sm:text-lg">{t(`${state}_description`)}</p>
        </motion.div>

        {state !== 'unavailable' && (
          <div>
            <motion.h2 {...entrance(0.2)} className="mb-5 text-center text-sm font-bold uppercase tracking-widest text-accent-green">{t('next_steps')}</motion.h2>
            <ol className="relative grid gap-5 md:grid-cols-2 md:gap-8">
              <motion.li {...entrance(0.3)} className="relative rounded-3xl border border-border-subtle bg-white p-6 shadow-sm sm:p-8">
                <div aria-hidden="true" className="mb-7 flex h-40 items-center justify-center rounded-2xl bg-canvas-light">
                  <motion.div
                    className="relative flex h-20 w-28 items-center justify-center rounded-2xl border border-border-subtle bg-white text-accent-green shadow-sm"
                    initial={reduceMotion ? false : { y: 8, rotate: -8 }}
                    animate={{ y: 0, rotate: -4 }}
                    transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.5 }}
                  >
                    <Mail className="h-12 w-12" strokeWidth={1.5} />
                    <motion.span
                      className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full border-4 border-canvas-light bg-accent-green text-white"
                      initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.9 }}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </motion.span>
                  </motion.div>
                </div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-accent-green">{t('step', { number: '01' })}</p>
                <h3 className="mb-3 text-2xl font-bold tracking-tight">{t('email_title')}</h3>
                <p className="text-sm leading-relaxed text-base-dark/65 sm:text-base">{t('email_description')}</p>
                <p className="mt-4 text-sm font-medium text-accent-green">{t('email_hint')}</p>
                <span aria-hidden="true" className="absolute -right-9 top-20 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-base-light text-accent-green md:flex">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </motion.li>

              <motion.li {...entrance(0.55)} className="rounded-3xl border border-border-subtle bg-white p-6 shadow-sm sm:p-8">
                <div aria-hidden="true" className="mb-7 flex h-40 items-center justify-center rounded-2xl bg-accent-green/5">
                  <motion.div
                    className="relative flex h-32 w-20 flex-col items-center justify-center overflow-hidden rounded-2xl border-[3px] border-accent-green bg-white text-accent-green shadow-sm"
                    initial={reduceMotion ? false : { y: 10 }} animate={{ y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.75 }}
                  >
                    <span className="absolute top-2 h-1 w-6 rounded-full bg-accent-green/20" />
                    <QrCode className="h-12 w-12" strokeWidth={1.5} />
                    <motion.span
                      className="absolute inset-x-2 top-9 h-0.5 bg-accent-gold shadow-[0_0_8px_#cb7913]"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={reduceMotion ? { opacity: 0 } : { y: [0, 46, 0], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.8, delay: 1.2, repeat: 1, ease: 'easeInOut' }}
                    />
                    <span className="absolute bottom-3 h-1 w-8 rounded-full bg-accent-green/20" />
                  </motion.div>
                </div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-accent-green">{t('step', { number: '02' })}</p>
                <h3 className="mb-3 text-2xl font-bold tracking-tight">{t('qr_title')}</h3>
                <p className="text-sm leading-relaxed text-base-dark/65 sm:text-base">{t('qr_description')}</p>
                <p className="mt-4 text-sm font-medium text-accent-green">{t('qr_hint')}</p>
              </motion.li>
            </ol>
            <motion.p {...entrance(0.8)} className="mt-7 flex items-center justify-center gap-2 text-center text-sm font-medium text-accent-green">
              <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />{t('see_you')}
            </motion.p>
          </div>
        )}

        <motion.div {...entrance(0.9)} className="mt-10 text-center">
          {state !== 'success' && (
            <button onClick={() => router.refresh()} className="mb-6 inline-flex min-h-12 items-center gap-2 rounded-xl border border-border-subtle px-5 py-3 text-sm font-bold transition-colors hover:bg-canvas-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />{t('refresh')}
            </button>
          )}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <Link href="/" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-accent-green px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-base-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green sm:w-auto">
              {t('home')}<ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link href="/termine" className="inline-flex min-h-12 items-center justify-center px-5 py-3 text-sm font-bold text-accent-green underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">{t('events')}</Link>
          </div>
          <p className="mt-8 text-sm leading-relaxed text-base-dark/60">
            {t('support')}{' '}<a href="mailto:servus@maurer-events.com" className="font-medium text-accent-green underline underline-offset-4">servus@maurer-events.com</a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
