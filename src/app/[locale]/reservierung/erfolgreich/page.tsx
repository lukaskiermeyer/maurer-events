import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getBookingConfirmation } from '@/lib/booking-confirmation';
import BookingConfirmation from '@/components/reservation/BookingConfirmation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'BookingConfirmation' });
  return {
    title: `${t('meta_title')} | MAURER EVENTS`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function BookingSuccessPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!routing.locales.some(language => language === locale)) notFound();
  const { session_id } = await searchParams;
  const state = await getBookingConfirmation(session_id);
  return <BookingConfirmation state={state} />;
}
