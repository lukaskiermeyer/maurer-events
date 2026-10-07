import nextDynamic from "next/dynamic";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import EventsSection from "@/components/EventsSection";
import { getEvents } from "@/app/actions/events";
import { getGalleryAlbums } from "@/app/actions/gallery";
import GallerySection from "@/components/GallerySection";
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const ContactSection = nextDynamic(() => import("@/components/ContactSection"), {
    loading: () => <div className="animate-pulse h-96 bg-base-light rounded-3xl mt-24"></div>
})



export const revalidate = 60;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.some(language => language === locale)) notFound();
  const [events, galleryAlbums] = await Promise.all([
    getEvents(),
    getGalleryAlbums()
  ]);

  return (
    <>
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <EventsSection initialEvents={events} />
      <GallerySection albums={galleryAlbums} sneakPeek={true} />
      <ContactSection />
    </>
  );
}
