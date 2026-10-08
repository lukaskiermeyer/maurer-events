"use client";
import Image from 'next/image';
import { useState } from 'react';
import { logout } from '@/app/actions/authActions';
import { Link, useRouter } from '@/i18n/routing';

export default function StaffHeader({ scannerOnly = false }: { scannerOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <header className="border-b border-border-light bg-white text-base-dark px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3 min-h-16">
        <Link href={scannerOnly ? '/admin/scan' : '/admin'} className="flex items-center gap-2 min-w-0 font-black text-accent-green">
          <Image src="/maennchen.svg" alt="" width={48} height={40} className="h-10 w-12 object-contain" />
          <span>{scannerOnly ? 'Einlass-Team' : 'Festwirt-Bereich'}</span>
        </Link>
        <button disabled={busy} type="button" className="min-h-11 px-3 rounded-lg text-sm font-bold border border-border-light disabled:opacity-50" onClick={async () => {
          setBusy(true);
          try { await logout(); router.replace('/admin/login'); router.refresh(); }
          catch { setBusy(false); }
        }}>{busy ? 'Abmelden…' : 'Abmelden'}</button>
      </div>
    </header>
  );
}
