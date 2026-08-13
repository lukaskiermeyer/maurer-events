import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getGalleryImages } from "@/app/actions/gallery";
import GalleryGrid from "@/components/GalleryGrid";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from 'next';

import { getTranslations } from "next-intl/server";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ eventId: string, locale: string }> }): Promise<Metadata> {
  const { eventId, locale } = await params;
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  
  if (!event) return {};
  
  const titleText = locale === "en" && event.titleEn ? event.titleEn : event.title;
  const descriptionText = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
  
  const ogImage = event.imageUrl || "https://maurer-events.com/og-image.jpg";
  const title = `${titleText} | MAURER EVENTS Galerie`;
  
  return {
    title,
    description: descriptionText,
    openGraph: {
      title,
      description: descriptionText,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: descriptionText,
      images: [ogImage],
    },
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ eventId: string, locale: string }> }) {
  const { eventId, locale } = await params;
  const t = await getTranslations("Gallery");

  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) notFound();

  const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
  const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
  const location = locale === "en" && event.locationEn ? event.locationEn : event.location;

  const images = await getGalleryImages(eventId);

  return (
    <div className="bg-base-light min-h-screen pt-24 pb-32">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
        
        {/* Back Button */}
        <Link href="/galerie" className="inline-flex items-center text-sm font-bold uppercase tracking-wide text-base-dark/50 hover:text-accent-green mb-12 transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t("back_to_overview") || "Zurück zur Übersicht"}
        </Link>

        {/* Album Header */}
        <div className="max-w-3xl mb-16">
          <h1 className="font-display font-black text-5xl md:text-7xl mb-6 text-base-dark">
            {title}
          </h1>
          <div className="flex items-center gap-4 text-sm font-bold uppercase tracking-wider text-base-dark/50 mb-6">
            <span>{new Date(event.date).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE')}</span>
            <span>•</span>
            <span>{location}</span>
          </div>
          <p className="font-sans text-lg md:text-xl text-base-dark/80 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Masonry Grid */}
        <GalleryGrid images={images} />
        
      </div>
    </div>
  );
}
