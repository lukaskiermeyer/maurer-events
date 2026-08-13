"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import ImageWithSkeleton from "./ImageWithSkeleton";
import { useTranslations, useLocale } from "next-intl";

export default function GallerySection({ albums, sneakPeek = false }: { albums?: any[], sneakPeek?: boolean }) {
  const t = useTranslations("Gallery");
  const locale = useLocale();
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  
  const displayAlbums = albums || [];
  
  const sortedAlbums = [...displayAlbums].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  // Startseite: Nur markierte Alben, maximal 4 (für ein sauberes 2x2 Grid)
  const visibleAlbums = sneakPeek 
    ? sortedAlbums.filter(a => a.isFeaturedGallery).slice(0, 4) 
    : sortedAlbums;

  if (visibleAlbums.length === 0 && !sneakPeek) return null;

  return (
    <section id="gallery" className="relative w-full bg-white py-24 md:py-32">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 md:mb-24 gap-6">
          <div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="font-display font-bold text-5xl md:text-7xl mb-4 text-base-dark"
            >
              {t("title_1_alt") || "Rückblick in"} <span className="text-accent-green">{t("title_2_alt") || "Bildern"}</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-sans text-lg text-base-dark/60 font-medium"
            >
              {t("subtitle") || "Entdecke die schönsten Momente unserer vergangenen Feste."}
            </motion.p>
          </div>
          
          {sneakPeek ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link href="/galerie" className="text-base-dark bg-border-light px-6 py-3 rounded-full hover:bg-accent-green hover:text-white font-display font-bold uppercase tracking-wide flex items-center gap-3 transition-colors text-sm shadow-sm">
                {t("view_all") || "Alle Alben ansehen"}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-border-light rounded-full text-sm font-bold shadow-sm hover:bg-base-light transition-colors text-base-dark"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                {t("sort_label") || "Sortieren"}: {sortOrder === "desc" ? (t("sort_newest") || "Neueste zuerst") : (t("sort_oldest") || "Älteste zuerst")}
              </button>
            </motion.div>
          )}
        </div>

        <div className={`grid ${sneakPeek ? 'grid-cols-2 gap-3 sm:gap-8 max-w-5xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8'}`}>
          {visibleAlbums.length === 0 && sneakPeek ? (
            <div className="col-span-full py-12 text-center text-base-dark/50 font-bold border border-dashed border-border-light rounded-2xl">
              {t("empty_homepage") || "Es wurden noch keine Galerien für die Startseite markiert."}
            </div>
          ) : visibleAlbums.map((album, i) => {
            const title = locale === "en" && album.titleEn ? album.titleEn : album.title;
            const description = locale === "en" && album.descriptionEn ? album.descriptionEn : album.description;
            
            return (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 4) * 0.1 }}
            >
              <Link 
                href={`/galerie/${album.id}`}
                className="group block relative overflow-hidden rounded-2xl border border-border-light shadow-sm bg-base-light transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="relative w-full aspect-[4/3] overflow-hidden">
                  <ImageWithSkeleton 
                    src={album.coverImage} 
                    alt={album.title}
                    className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                    wrapperClassName="w-full h-full"
                  />
                  <div className="absolute top-4 right-4 bg-base-dark/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    {album.imageCount} {t("images") || "Bilder"}
                  </div>
                </div>
                <div className="p-3 sm:p-6">
                  <h4 className="font-display font-bold text-lg sm:text-xl text-base-dark mb-1 group-hover:text-accent-green transition-colors line-clamp-1">{title}</h4>
                  <p className="text-base-dark/50 text-xs sm:text-sm font-bold mb-2 sm:mb-3">
                    {new Date(album.date).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE')}
                  </p>
                  <p className="font-sans text-xs sm:text-sm text-base-dark/70 line-clamp-2">
                    {description}
                  </p>
                </div>
              </Link>
            </motion.div>
          )})}
        </div>
      </div>
    </section>
  );
}
