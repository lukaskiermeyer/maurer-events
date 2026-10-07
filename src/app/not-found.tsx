import { getLocale } from 'next-intl/server';
import SiteShell from '@/components/SiteShell';
import NotFoundContent from '@/components/NotFoundContent';

export default async function NotFound() {
  const locale = await getLocale();
  return <SiteShell locale={locale}><NotFoundContent locale={locale} /></SiteShell>;
}
