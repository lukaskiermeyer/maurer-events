"use client";
import Image from 'next/image';

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isInHero, setIsInHero] = useState(true);
  const pathname = usePathname();
  const t = useTranslations("Navbar");

  const isHome = pathname === "/" || pathname === "/de" || pathname === "/en";
  // Mobile: Header schon im Hero sichtbar (transparent), Desktop wie bisher
  // erst nach 80 % Scroll.
  // Header immer sichtbar (auch auf großen Bildschirmen / Startseite)
  const showNavbar = true;
  // Transparent im Hero (auch auf großen Bildschirmen), nicht bei offenem Menue.
  const transparent = isHome && isInHero && !isOpen;

  useEffect(() => {
    // Wenn wir nicht auf der Startseite sind, zeigen wir die Navbar immer
    // Need to handle locales in pathname, e.g., /en or /de or /
    if (!isHome) return;

    const handleScroll = () => {
      // Transparent, solange das Hero noch unter dem Header liegt
      // (Hero-Unterkante per getBoundingClientRect statt innerHeight -
      // innerHeight ist auf Mobile dynamisch und springt beim Ein-/Ausblenden
      // der Browserleiste, dadurch kippte der Wechsel an falscher Stelle
      // und weisses Logo lag auf hellem Grund).
      const hero = document.getElementById("start");
      setIsInHero(hero ? hero.getBoundingClientRect().bottom > 96 : window.scrollY < window.innerHeight);
      // Header bleibt immer sichtbar – Menue bei Scroll nach oben schliessen
      if (window.scrollY <= window.innerHeight * 0.8) {
        setIsOpen(false);
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isHome]);

  if (pathname.includes("/admin")) return null;

  const navLinks = [
    { name: t("startseite"), href: "/#start" },
    { name: t("about"), href: "/#about" },
    { name: t("services"), href: "/#services" },
    { name: t("events"), href: "/#events" },
    { name: t("karriere"), href: "/karriere" },
    { name: t("contact"), href: "/#contact" },
  ];

  return (
    <>
      <nav 
        className={`fixed w-full z-50 transition-all duration-500 ease-in-out ${
          transparent
            ? "bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-[0_1px_12px_rgba(0,0,0,0.08)]"
            : "bg-base-light/80 backdrop-blur-md border-b border-base-dark/60"
        } ${
          showNavbar ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-10 xl:px-16">
          <div className="flex justify-between items-center h-24">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/#start" className="flex items-center gap-3 group">
                <Image src="/Logo.png" alt="Maurer Events Logo" width={324} height={96} className={`h-12 lg:h-10 xl:h-12 w-auto object-contain transition-[filter,transform] duration-500 group-hover:scale-105 ${transparent ? "brightness-0 invert drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" : ""}`} priority sizes="162px" />
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden lg:flex flex-shrink-0 items-center space-x-5 xl:space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`font-sans text-xs xl:text-sm font-bold tracking-wide whitespace-nowrap transition-colors ${transparent ? "text-white hover:text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" : "text-base-dark hover:text-accent-green"}`}
                >
                  {link.name}
                </Link>
              ))}
              <LanguageSwitcher glass={transparent} />
              <Link
                href="/#contact"
                className="px-4 py-2.5 xl:px-6 xl:py-3 bg-accent-green text-white rounded-full font-display font-bold tracking-wide text-xs xl:text-sm whitespace-nowrap hover:bg-base-dark transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
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
                aria-label="Toggle menu"
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
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block py-3 text-base-dark font-sans text-lg font-bold border-b border-border-light/50 hover:text-accent-green"
                  >
                    {link.name}
                  </Link>
                ))}
                <Link
                  href="/#contact"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center mt-6 px-6 py-4 bg-accent-green text-white rounded-xl font-display font-bold shadow-md"
                >
                  {t("event_anfragen")}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
