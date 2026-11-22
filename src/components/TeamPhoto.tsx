import fs from "fs";
import path from "path";

import Image from "next/image";
import { useTranslations } from "next-intl";

const CANDIDATES = ["team.jpg", "team.jpeg", "team.png", "team.webp"];

// Gruppenfoto des Teams: liegt eine Datei als public/team.* im Projekt,
// wird sie automatisch angezeigt; sonst erscheint ein Platzhalter-Rahmen.
export default function TeamPhoto({ className = "" }: { className?: string }) {
  const t = useTranslations("CareersTeaser");
  const file = CANDIDATES.find(name => fs.existsSync(path.join(process.cwd(), "public", name)));

  if (!file) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-accent-green/40 bg-canvas-light text-base-dark/50 ${className}`}
        role="img"
        aria-label={t("team_photo_placeholder")}
      >
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3m-9 0a3 3 0 103 3" />
        </svg>
        <span className="font-sans text-sm font-bold uppercase tracking-widest">{t("team_photo_placeholder")}</span>
      </div>
    );
  }

  return (
    <Image
      src={`/team.${file.split(".").slice(1).join(".")}`}
      alt={t("team_photo_alt")}
      fill
      sizes="(max-width: 640px) 100vw, 480px"
      className={`object-cover ${className}`}
    />
  );
}
