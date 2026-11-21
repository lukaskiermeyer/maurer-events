"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyRequestButton from "@/components/StickyRequestButton";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = pathname.startsWith("/admin") || pathname.startsWith("/team");

  // Hash-Links (z. B. /#contact) beim Laden/Navigation scrollen, da der
  // Browser das bei client-seitigem Rendering oft nicht von selbst macht.
  useEffect(() => {
    if (isPortal) return;
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.replace("#", "");
    const scrollTo = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      return false;
    };
    // Sofort versuchen, sonst nach Render wiederholen
    if (!scrollTo()) {
      const t = setTimeout(scrollTo, 300);
      return () => clearTimeout(t);
    }
  }, [isPortal, pathname]);

  if (isPortal) return <main className="flex-grow">{children}</main>;
  return (
    <>
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
      <StickyRequestButton />
    </>
  );
}