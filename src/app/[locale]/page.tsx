import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import EventsSection from "@/components/EventsSection";
import ContactSection from "@/components/ContactSection";
import { getEvents } from "@/app/actions/events";

export const runtime = 'edge';

export const revalidate = 60; // Optional: revalidate every minute if not using on-demand revalidation

export default async function Home() {
  const events = await getEvents();

  return (
    <>
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <EventsSection initialEvents={events} />
      <ContactSection />
    </>
  );
}
