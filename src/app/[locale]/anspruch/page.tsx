import type { Metadata } from "next";

import IdentitySection from "@/components/IdentitySection";

const TITLES: Record<string, { title: string; description: string }> = {
  en: {
    title: "Our Identity & Our Claim | MAURER EVENTS",
    description: "Organic quality, regionality and craft: what Maurer Events stands for – from the inn parlour to the festival tent.",
  },
  bar: {
    title: "Unsare Identität & Unsa Ospruch | MAURER EVENTS",
    description: "Bio-Qualität, Regionalität und Handwerk: wofür Maurer Events steht – aus da Wirtsstubn ins Festzelt.",
  },
  de: {
    title: "Unsere Identität & Unser Anspruch | MAURER EVENTS",
    description: "Bio-Qualität, Regionalität und Handwerk: wofür Maurer Events steht – von der Wirtsstube bis ins Festzelt.",
  },
};

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return params.then(({ locale }) => {
    const entry = TITLES[locale] ?? TITLES.de;
    return { title: entry.title, description: entry.description };
  });
}

export default function IdentityPage() {
  return (
    <main className="min-h-screen bg-base-light">
      <IdentitySection />
    </main>
  );
}
