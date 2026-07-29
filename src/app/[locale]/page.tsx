import dynamic from "next/dynamic";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import EventsSection from "@/components/EventsSection";
import { getEvents } from "@/app/actions/events";

const ContactSection = dynamic(() => import("@/components/ContactSection"), {
    loading: () => <div className="animate-pulse h-96 bg-base-light rounded-3xl mt-24"></div>
})

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
