import type { Metadata } from 'next';

import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { widerruf, LEGAL_REVIEW_PENDING } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: `${widerruf.title} | MAURER EVENTS`,
  description: widerruf.description,
  alternates: { canonical: '/widerruf', languages: { de: '/widerruf', en: '/en/widerruf' } },
  robots: LEGAL_REVIEW_PENDING ? { index: false, follow: true } : undefined,
};

export default function WiderrufPage() {
  return <LegalDocumentPage document={widerruf} />;
}