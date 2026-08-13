"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import MadeByLui from "./MadeByLui";

export default function Footer() {
  const pathname = usePathname();
  const t = useTranslations("Footer");
  const navT = useTranslations("Navbar"); // Re-use Navbar translations for navigation links

  if (pathname.includes("/admin")) return null;

  return (
    <footer className="bg-accent-green text-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 py-16 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-8">
          
          <div className="col-span-2 md:col-span-2 flex flex-col items-center md:items-start text-center md:text-left">
            <Link href="/#start" className="mb-6 md:mb-8 hover:opacity-90 transition-opacity block">
              <img src="/Logo.png" alt="Maurer Events Logo" className="h-16 sm:h-20 md:h-24 w-auto object-contain brightness-0 invert drop-shadow-md" />
            </Link>
            <p className="font-sans text-white/80 mb-8 max-w-sm text-sm leading-relaxed">
              {t("brand_desc")}
            </p>
            <div className="flex justify-center md:justify-start space-x-4">
              {/* Social Links placeholder (Softer style) */}
              <a href="https://www.tiktok.com/@damaurerwirt" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white hover:text-accent-green transition-colors">
                <span className="sr-only">TikTok</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.68a6.34 6.34 0 0 0 6.27 6.32 6.32 6.32 0 0 0 6.16-5.32V10.2a8.38 8.38 0 0 0 4.57 1.34V8.08a4.93 4.93 0 0 1-2.41-1.39z" /></svg>
              </a>
              <a href="https://www.instagram.com/damaurerwirt" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white hover:text-accent-green transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
              </a>
            </div>
          </div>
          
          <div className="flex flex-col items-start md:items-start text-left">
            <h4 className="font-display font-bold mb-4 md:mb-6 text-white uppercase tracking-widest text-xs">Navigation</h4>
            <ul className="space-y-3 md:space-y-4 text-sm font-bold text-white/80">
              <li><Link href="/#about" className="hover:text-white transition-colors">{navT("about")}</Link></li>
              <li><Link href="/#services" className="hover:text-white transition-colors">{navT("services")}</Link></li>
              <li><Link href="/#events" className="hover:text-white transition-colors">{navT("events")}</Link></li>
              <li><Link href="/#contact" className="hover:text-white transition-colors">{navT("contact")}</Link></li>
            </ul>
          </div>
          
          <div className="flex flex-col items-start md:items-start text-left">
            <h4 className="font-display font-bold mb-4 md:mb-6 text-white uppercase tracking-widest text-xs">{t("contact_title")}</h4>
            <ul className="space-y-3 md:space-y-4 text-white/80 text-sm break-words hyphens-auto pr-2">
              <li>MAURER EVENTS</li>
              <li>Schwaiger Str. 6</li>
              <li>85126 Müchsmünster</li>
              <li className="pt-4"><a href="mailto:servus@maurer-events.com" className="hover:text-white transition-colors block border-b border-white/20 pb-2 inline-block">servus@maurer-events.com</a></li>
            </ul>
          </div>
        </div>
      </div>
        
      <div className="bg-base-dark">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 py-2 flex flex-col md:flex-row justify-between items-center md:items-center gap-2 md:gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left text-xs text-white/60 font-sans font-medium">
            <p>&copy; {new Date().getFullYear()} {t("rights")}</p>
            <div className="flex space-x-6 md:space-x-8">
              <Link href="/impressum" className="hover:text-white transition-colors">{t("impressum")}</Link>
              <Link href="/datenschutz" className="hover:text-white transition-colors">{t("datenschutz")}</Link>
            </div>
          </div>
          <div>
            <MadeByLui dark={true} />
          </div>
        </div>
      </div>
    </footer>
  );
}
