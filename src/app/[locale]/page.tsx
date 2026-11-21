import fs from "fs";
import path from "path";

import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import EventsSection from "@/components/EventsSection";
import ContactSection from "@/components/ContactSection";
import PartnersSection, { type PartnerLogo } from "@/components/PartnersSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import TeamPhoto from "@/components/TeamPhoto";
import { getEvents } from "@/app/actions/events";
import { getGalleryAlbums, getFavoriteGalleryImages } from "@/app/actions/gallery";
import { getPublicEventDocumentsForEvents } from "@/app/actions/eventDocuments";
import { getCareerContent } from "@/app/actions/career";
import { localizeCareerContent } from "@/lib/career";
import GallerySection from "@/components/GallerySection";
import CareersTeaser from "@/components/CareersTeaser";
import { notFound } from 'next/navigation';
import { redirect, routing } from '@/i18n/routing';



export const revalidate = 60;

// Partnerlogos werden ohne Code-Änderung aufgenommen: jede Bilddatei in
// public/partners/ erscheint als Kreis in der Partner-Sektion.
function readPartnerLogos(): PartnerLogo[] {
  try {
    const dir = path.join(process.cwd(), "public", "partners");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter(file => /\.(png|jpe?g|svg|webp)$/i.test(file))
      .sort()
      .map(file => ({
        name: file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        src: `/partners/${file}`,
      }));
  } catch {
    return [];
  }
}

export default async function Home({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ success?: string | string[]; session_id?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!routing.locales.some(language => language === locale)) notFound();
  const query = await searchParams;
  // Existing Stripe sessions retain their original return URL.
  if (query.success === 'true') {
    const sessionQuery = typeof query.session_id === 'string' ? `?${new URLSearchParams({ session_id: query.session_id })}` : '';
    redirect({ href: `/reservierung/erfolgreich${sessionQuery}`, locale });
  }
  const [events, galleryAlbums, galleryFavorites, documentsByEvent, careerRaw] = await Promise.all([
    getEvents(),
    getGalleryAlbums(),
    getFavoriteGalleryImages(8),
    getPublicEventDocumentsForEvents(),
    getCareerContent()
  ]);
  const careerContent = localizeCareerContent(careerRaw, locale);
  const partnerLogos = readPartnerLogos();

  return (
    <>
      <HeroSection />
      <EventsSection initialEvents={events} documentsByEvent={documentsByEvent} />
        <AboutSection />
      <PartnersSection logos={partnerLogos} />
      <ServicesSection />
      <TestimonialsSection />
      <GallerySection albums={galleryAlbums} sneakPeek={true} favorites={galleryFavorites} />
      <ContactSection />
      <CareersTeaser content={careerContent}>
        <TeamPhoto className="absolute inset-0" />
      </CareersTeaser>
    </>
  );
}
