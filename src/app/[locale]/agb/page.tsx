import type { Metadata } from 'next';

import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { agb, LEGAL_REVIEW_PENDING } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: `${agb.title} | MAURER EVENTS`,
  description: agb.description,
  alternates: { canonical: '/agb', languages: { de: '/agb', en: '/en/agb' } },
  robots: LEGAL_REVIEW_PENDING ? { index: false, follow: true } : undefined,
};

export default function AgbPage() {
  return <LegalDocumentPage document={agb} />;
}