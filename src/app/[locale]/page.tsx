import nextDynamic from "next/dynamic";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import EventsSection from "@/components/EventsSection";
import { getEvents } from "@/app/actions/events";
import { getGalleryAlbums } from "@/app/actions/gallery";
import GallerySection from "@/components/GallerySection";

const ContactSection = nextDynamic(() => import("@/components/ContactSection"), {
    loading: () => <div className="animate-pulse h-96 bg-base-light rounded-3xl mt-24"></div>
})



export const revalidate = 60;

export default async function Home() {
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
