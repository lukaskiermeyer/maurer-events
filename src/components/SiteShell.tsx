import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import DocumentLanguage from '@/components/DocumentLanguage';
import SiteChrome from '@/components/SiteChrome';

export default async function SiteShell({ locale, children }: { locale: string; children: React.ReactNode }) {
  const messages = await getMessages({ locale });
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DocumentLanguage />
      <SiteChrome>{children}</SiteChrome>
    </NextIntlClientProvider>
  );
}
