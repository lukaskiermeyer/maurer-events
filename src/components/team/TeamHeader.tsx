"use client";

import Image from "next/image";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { staffLogout } from "@/app/actions/staffAuth";

export default function TeamHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const compact = pathname === "/team/login" || pathname === "/team/einladung";
  return (
    <header className="border-b border-border-light bg-white">
      <div className="max-w-[1100px] mx-auto min-h-16 px-4 flex items-center justify-between gap-3">
        <Link href="/team" className="flex items-center gap-2 font-black text-accent-green min-w-0">
          <Image src="/maennchen.svg" alt="" width={48} height={40} className="h-10 w-12 object-contain" />
          <span className="truncate">Mitarbeiterportal</span>
        </Link>
        {!compact && (
          <button type="button" onClick={async () => { await staffLogout(); router.replace("/team/login"); router.refresh(); }} className="min-h-11 px-3 rounded-lg text-sm font-bold border border-border-light">
            Abmelden
          </button>
        )}
      </div>
    </header>
  );
}