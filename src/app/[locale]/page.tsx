import nextDynamic from "next/dynamic";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import EventsSection from "@/components/EventsSection";
import { getEvents } from "@/app/actions/events";
import { getGalleryAlbums } from "@/app/actions/gallery";
import { getPublicEventDocumentsForEvents } from "@/app/actions/eventDocuments";
import { getCareerContent } from "@/app/actions/career";
import { localizeCareerContent } from "@/lib/career";
import GallerySection from "@/components/GallerySection";
import CareersTeaser from "@/components/CareersTeaser";
import { notFound } from 'next/navigation';
import { redirect, routing } from '@/i18n/routing';

const ContactSection = nextDynamic(() => import("@/components/ContactSection"), {
    loading: () => <div className="animate-pulse h-96 bg-base-light rounded-3xl mt-24"></div>
})



export const revalidate = 60;

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
  const [events, galleryAlbums, documentsByEvent, careerRaw] = await Promise.all([
    getEvents(),
    getGalleryAlbums(),
    getPublicEventDocumentsForEvents(),
    getCareerContent()
  ]);
  const careerContent = localizeCareerContent(careerRaw, locale);

  return (
    <>
      <HeroSection />
      <EventsSection initialEvents={events} documentsByEvent={documentsByEvent} />
        <AboutSection />
      <ServicesSection />
      <GallerySection albums={galleryAlbums} sneakPeek={true} />
      <CareersTeaser content={careerContent} />
      <ContactSection />
    </>
  );
}
