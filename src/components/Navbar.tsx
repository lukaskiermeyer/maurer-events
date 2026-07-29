"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNavbar, setShowNavbar] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("Navbar");

  useEffect(() => {
    // Wenn wir nicht auf der Startseite sind, zeigen wir die Navbar immer
    // Need to handle locales in pathname, e.g., /en or /de or /
    const isHome = pathname === "/" || pathname === "/de" || pathname === "/en";
    
    if (!isHome) {
      setShowNavbar(true);
      return;
    }

    const handleScroll = () => {
      // Show navbar after scrolling past 80% of the viewport height (nur auf Startseite)
      if (window.scrollY > window.innerHeight * 0.8) {
        setShowNavbar(true);
      } else {
        setShowNavbar(false);
        setIsOpen(false);
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  const navLinks = [
    { name: t("startseite"), href: "/#start" },
    { name: t("about"), href: "/#about" },
    { name: t("services"), href: "/#services" },
    { name: t("events"), href: "/#events" },
    { name: t("contact"), href: "/#contact" },
  ];

  return (
    <>
      <nav 
        className={`fixed w-full z-50 bg-base-light/95 backdrop-blur-md border-b border-base-dark transition-all duration-500 ease-in-out ${
          showNavbar ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
          <div className="flex justify-between items-center h-24">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/#start" className="flex items-center gap-3 group">
                <img src="/Logo.png" alt="Maurer Events Logo" className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8 lg:space-x-10">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href as any}
                  className="text-base-dark hover:text-accent-green font-sans text-sm font-bold tracking-wide transition-colors"
                >
                  {link.name}
                </Link>
              ))}
              <LanguageSwitcher />
              <Link
                href="/#contact"
                className="px-6 py-3 bg-accent-green text-white rounded-full font-display font-bold tracking-wide text-sm hover:bg-base-dark transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                {t("event_anfragen")}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-4">
              <LanguageSwitcher />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-base-dark hover:text-accent-green focus:outline-none"
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
              className="md:hidden bg-base-light border-b border-border-light overflow-hidden shadow-xl"
            >
              <div className="px-6 pt-4 pb-8 space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href as any}
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
