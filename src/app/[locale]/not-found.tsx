import { getLocale } from 'next-intl/server';
import NotFoundContent from '@/components/NotFoundContent';

export default async function NotFound() {
  const locale = await getLocale();
  return <NotFoundContent locale={locale} />;
}
