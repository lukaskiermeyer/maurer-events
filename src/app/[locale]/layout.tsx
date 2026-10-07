import { getLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import SiteShell from '@/components/SiteShell';

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  const locale = routing.locales.some(language => language === requestedLocale) ? requestedLocale : await getLocale();
  return <SiteShell locale={locale}>{children}</SiteShell>;
}
