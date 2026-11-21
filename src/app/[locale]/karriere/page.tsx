import { cache } from "react";
import { Metadata } from "next";

import { getCareerContent } from "@/app/actions/career";
import CareerSection from "@/components/career/CareerSection";
import TeamPhoto from "@/components/TeamPhoto";
import { localizeCareerContent } from "@/lib/career";

export const revalidate = 60;

// Einmal pro Request laden, auch wenn Metadaten und Seite beides brauchen.
const loadCareer = cache(getCareerContent);

function summarize(text: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const content = localizeCareerContent(await loadCareer(), locale);
  return {
    title: `${content.headline} | Karriere bei Maurer Events`,
    description: summarize(content.intro),
  };
}

export default async function KarrierePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const content = localizeCareerContent(await loadCareer(), locale);

  return (
    <main className="min-h-screen bg-base-light pt-24 pb-16">
      <CareerSection content={content}>
        <TeamPhoto className="absolute inset-0" />
      </CareerSection>
    </main>
  );
}