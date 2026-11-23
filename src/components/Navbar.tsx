"use client";
import Image from 'next/image';

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ui } from "@/lib/localize";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isInHero, setIsInHero] = useState(true);
  const pathname = usePathname();
  const t = useTranslations("Navbar");
  const locale = useLocale();

  const isHome = pathname === "/" || pathname === "/de" || pathname === "/en" || pathname === "/bar";
  // Event-Übersicht und Event-Details haben ebenfalls einen dunklen Hero-Bereich (Festzelt-Decke),
  // daher dort den Header ebenfalls glass/polymorph (wie im Hero) rendern.
  const isHeroPage = isHome || /\/termine(\/|$)/.test(pathname);
  // Event-Details: Kopfzone ist grün (Zeltdach-Giebel) → Navbar komplett transparent,
  // damit kein Weißschleier über dem Grün liegt und der Giebel bündig anschließt.
  const isEventDetail = /\/termine\/[^/]+/.test(pathname);
  const showNavbar = true;
  const transparent = isHeroPage && isInHero && !isOpen;

  useEffect(() => {
    // Wenn wir nicht auf einer Hero-Seite sind, zeigen wir die Navbar immer (solid).
    if (!isHeroPage) {
      setIsInHero(false);
      return;
    }

    const handleScroll = () => {
      // Transparent, solange das Hero noch unter dem Header liegt
      const hero = document.getElementById("start");
      if (hero) {
        setIsInHero(hero.getBoundingClientRect().bottom > 96);
      } else {
        // Auf Event-Übersicht/Details gibt es kein #start-Element;
        // glas/polymorph solange der Scroll noch im oberen Bereich liegt.
        setIsInHero(window.scrollY < 160);
      }
      if (window.scrollY <= window.innerHeight * 0.8) {
        setIsOpen(false);
      }
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isHeroPage]);

  if (pathname.includes("/admin")) return null;

  const navLinks = [
    { name: t("startseite"), href: "/#start" },
    { name: t("services"), href: "/#services" },
    { name: t("events"), href: "/#events" },
    { name: t("about"), href: "/ueber-uns" },
    { name: t("identitaet"), href: "/anspruch" },
    { name: t("contact"), href: "/#contact" },
    { name: t("karriere"), href: "/karriere" },
  ];

  return (
    <>
      <nav 
        className={`fixed w-full z-50 transition-all duration-500 ease-in-out ${
          transparent
            ? isEventDetail
              ? "bg-transparent backdrop-blur-xl border-b border-accent-green shadow-[0_1px_12px_rgba(0,0,0,0.08)]"
              : "bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-[0_1px_12px_rgba(0,0,0,0.08)]"
            : "bg-base-light/80 backdrop-blur-md border-b border-base-dark/60"
        } ${
          showNavbar ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-10 xl:px-16">
          <div className="flex justify-between items-center h-24">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/#start" className="flex items-center gap-3 group">
                <Image src="/LogoFinalGrün_MaurerEvents.svg" alt="Maurer Events Logo" width={299} height={140} className={`h-12 lg:h-10 xl:h-12 w-auto object-contain transition-[filter,transform] duration-500 group-hover:scale-105 ${transparent ? "brightness-0 invert drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" : ""}`} priority sizes="162px" />
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden lg:flex flex-shrink-0 items-center space-x-5 xl:space-x-8">
              {navLinks.map((link) => {
                const isHashLink = link.href.startsWith("/#");
                // Auf Unterseiten fuehrt ein client-seitiger Hash-Link nicht zur
                // Startseite – deshalb dort voller Seitenwechsel (garantiert Scroll).
                if (isHashLink && !isHome) {
                  return (
                    <a
                      key={link.name}
                      href={link.href}
                      className={`font-sans text-xs xl:text-sm font-bold tracking-wide whitespace-nowrap transition-colors ${transparent ? "text-white hover:text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" : "text-base-dark hover:text-accent-green"}`}
                    >
                      {link.name}
                    </a>
                  );
                }
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`font-sans text-xs xl:text-sm font-bold tracking-wide whitespace-nowrap transition-colors ${transparent ? "text-white hover:text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" : "text-base-dark hover:text-accent-green"}`}
                  >
                    {link.name}
                  </Link>
                );
              })}
              <LanguageSwitcher glass={transparent} />
              <Link
                href="/#contact"
                className="px-4 py-2.5 xl:px-6 xl:py-3 bg-accent-wood text-white rounded-full font-display font-bold tracking-wide text-xs xl:text-sm whitespace-nowrap hover:bg-accent-wood/80 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                {t("event_anfragen")}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-4">
              <LanguageSwitcher glass={transparent} />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`${transparent ? "text-white" : "text-base-dark hover:text-accent-green"} focus:outline-none transition-colors duration-500`}
                aria-label={ui(locale, { de: "Menü umschalten", en: "Toggle menu", bar: "Menü umschaltn" })}
                aria-expanded={isOpen}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-base-light border-b border-border-light overflow-hidden shadow-xl"
            >
              <div className="px-6 pt-4 pb-8 space-y-4">
                {navLinks.map((link) => {
                  const isHashLink = link.href.startsWith("/#");
                  if (isHashLink && !isHome) {
                    return (
                      <a
                        key={link.name}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className="block py-3 text-base-dark font-sans text-lg font-bold border-b border-border-light/50 hover:text-accent-green"
                      >
                        {link.name}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block py-3 text-base-dark font-sans text-lg font-bold border-b border-border-light/50 hover:text-accent-green"
                    >
                      {link.name}
                    </Link>
                  );
                })}
                {isHome ? (
                  <Link
                    href="/#contact"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center mt-6 px-6 py-4 bg-accent-wood text-white rounded-xl font-display font-bold shadow-md"
                  >
                    {t("event_anfragen")}
                  </Link>
                ) : (
                  <a
                    href="/#contact"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center mt-6 px-6 py-4 bg-accent-wood text-white rounded-xl font-display font-bold shadow-md"
                  >
                    {t("event_anfragen")}
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
