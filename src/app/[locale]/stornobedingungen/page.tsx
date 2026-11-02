import type { Metadata } from 'next';

import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { stornobedingungen, LEGAL_REVIEW_PENDING } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: `${stornobedingungen.title} | MAURER EVENTS`,
  description: stornobedingungen.description,
  alternates: { canonical: '/stornobedingungen', languages: { de: '/stornobedingungen', en: '/en/stornobedingungen' } },
  robots: LEGAL_REVIEW_PENDING ? { index: false, follow: true } : undefined,
};

export default function StornobedingungenPage() {
  return <LegalDocumentPage document={stornobedingungen} />;
}