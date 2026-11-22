"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

// Sticky Anfrage-Tab an der rechten Seite: springt zum Anfragebereich
// (#contact) bzw. navigiert auf anderen Seiten dorthin. Wird ausgeblendet,
// solange der Anfragebereich selbst im Sichtfeld ist.
export default function StickyRequestButton() {
  const t = useTranslations("Sticky");
  const pathname = usePathname();
  const router = useRouter();
  const [contactVisible, setContactVisible] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const contact = document.getElementById("contact");
    if (!contact) {
      setContactVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setContactVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(contact);
    return () => observer.disconnect();
  }, [pathname]);

  if (contactVisible) return null;

  const handleClick = () => {
    if (isHome) {
      document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push("/#contact");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("aria")}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-accent-wood text-white w-12 h-12 md:w-14 md:h-14 rounded-l-2xl shadow-xl hover:bg-accent-wood/80 transition-colors flex items-center justify-center"
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </button>
  );
}
