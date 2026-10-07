'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

export default function DocumentLanguage() {
  const locale = useLocale();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return null;
}
