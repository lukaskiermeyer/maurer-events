import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import UeberUnsHero from "@/components/UeberUnsHero";
import TeamVoices, { type TeamVoice } from "@/components/TeamVoices";
import TeamPhoto from "@/components/TeamPhoto";
import { routing } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UeberUns" });
  return { title: t("meta_title") };
}

export default async function UeberUnsPage({ params }: Params) {
  const { locale } = await params;
  if (!routing.locales.some((language) => language === locale)) notFound();

  const t = await getTranslations({ locale, namespace: "UeberUns" });
  const voices = t.raw("voices") as TeamVoice[];

  return (
    // pt-24: Abstand unter die fixe Navbar (die Subpage hat keinen eigenen Hero).
    <div className="pt-24">
      <UeberUnsHero />
      <TeamVoices voices={voices}>
        <TeamPhoto className="absolute inset-0" />
      </TeamVoices>
    </div>
  );
}
