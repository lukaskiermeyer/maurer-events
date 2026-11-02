import { cache } from "react";
import { Metadata } from "next";

import { getCareerContent } from "@/app/actions/career";
import CareerSection from "@/components/career/CareerSection";

export const revalidate = 60;

// Einmal pro Request laden, auch wenn Metadaten und Seite beides brauchen.
const loadCareer = cache(getCareerContent);

function summarize(text: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await loadCareer();
  return {
    title: `${content.headline} | Karriere bei Maurer Events`,
    description: summarize(content.intro),
  };
}

export default async function KarrierePage() {
  const content = await loadCareer();

  return (
    <main className="min-h-screen bg-base-light pt-24 pb-16">
      <CareerSection content={content} />
    </main>
  );
}