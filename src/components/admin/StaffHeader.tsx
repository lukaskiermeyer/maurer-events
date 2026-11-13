"use client";
import Image from 'next/image';
import { useState } from 'react';
import { logout } from '@/app/actions/authActions';
import { Link, usePathname, useRouter } from '@/i18n/routing';

const NAV_ITEMS = [
  {
    href: '/admin',
    label: 'Feste',
    isActive: (pathname: string) =>
      pathname === '/admin' || pathname.startsWith('/admin/events'),
  },
  {
    href: '/admin/kunden',
    label: 'Kunden',
    isActive: (pathname: string) => pathname.startsWith('/admin/kunden'),
  },
  {
    href: '/admin/mitarbeiter',
    label: 'Mitarbeiter',
    isActive: (pathname: string) => pathname.startsWith('/admin/mitarbeiter'),
  },
  {
    href: '/admin/personal',
    label: 'Personal',
    isActive: (pathname: string) => pathname.startsWith('/admin/personal'),
  },
] as const;

function NavPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 sm:px-5 text-sm font-bold transition-all duration-200 ${
        active
          ? 'bg-accent-green text-white shadow-md shadow-accent-green/25 ring-2 ring-accent-green/20'
          : 'text-base-dark/55 hover:bg-white hover:text-base-dark active:bg-base-light'
      }`}
    >
      {label}
    </Link>
  );
}

export default function StaffHeader({ scannerOnly = false }: { scannerOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border-light bg-white/95 text-base-dark shadow-[0_1px_12px_rgba(0,0,0,0.04)] backdrop-blur">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 min-h-16">
          <Link
            href={scannerOnly ? '/admin/scan' : '/admin'}
            className="flex items-center gap-2 min-w-0 font-black text-accent-green shrink-0"
          >
            <Image src="/maennchen.svg" alt="" width={48} height={40} className="h-10 w-12 object-contain" />
            <span className="truncate">{scannerOnly ? 'Einlass-Team' : 'Festwirt-Bereich'}</span>
          </Link>

          {!scannerOnly && (
            <nav
              aria-label="Hauptnavigation"
              className="hidden sm:flex items-center gap-1 bg-base-light/80 border border-border-light rounded-full p-1"
            >
              {NAV_ITEMS.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={item.isActive(pathname)}
                />
              ))}
            </nav>
          )}

          <button
            disabled={busy}
            type="button"
            className="min-h-11 px-3 sm:px-4 rounded-full text-sm font-bold border border-border-light bg-white hover:border-base-dark/30 hover:bg-base-light transition-colors disabled:opacity-50 shrink-0"
            onClick={async () => {
              setBusy(true);
              try { await logout(); router.replace('/admin/login'); router.refresh(); }
              catch { setBusy(false); }
            }}
          >
            {busy ? 'Abmelden…' : 'Abmelden'}
          </button>
        </div>

        {!scannerOnly && (
          <nav
            aria-label="Hauptnavigation mobil"
            className="sm:hidden flex items-center gap-1 bg-base-light/80 border border-border-light rounded-2xl p-1 mb-3"
          >
            {NAV_ITEMS.map((item) => (
              <NavPill
                key={item.href}
                href={item.href}
                label={item.label}
                active={item.isActive(pathname)}
              />
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
