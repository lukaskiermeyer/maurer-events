import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import HeroScene from "@/components/HeroScene";

export default async function HeroSection() {
    const t = await getTranslations("Hero");

    return (
        <section
            id="start"
            className="relative h-[100vh] min-h-[640px] w-full overflow-hidden bg-[#03497e] border-b-4 border-black select-none"
        >
            <HeroScene />

            {/* Quick-Actions unten mittig in den Nebelwolken (unteres
                Fuenftel) - auch auf Mobile nebeneinander, gross. */}
            <div className="hero-actions absolute inset-x-0 bottom-6 z-40 flex flex-row items-center justify-center gap-3 px-3 md:bottom-7 md:gap-4 select-text">
                <Link
                    href="/#contact"
                    className="flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-black bg-[#a86410] px-5 py-3.5 text-center font-display text-sm font-bold tracking-wide whitespace-nowrap text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-accent-green hover:shadow-xl min-[420px]:px-7 min-[420px]:py-4 min-[420px]:text-base md:px-11 md:py-5 md:text-lg"
                >
                    {t("cta_primary")}
                </Link>
                <Link
                    href="/#events"
                    className="flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-black bg-accent-green px-5 py-3.5 text-center font-display text-sm font-bold tracking-wide whitespace-nowrap text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-accent-green/80 hover:shadow-xl min-[420px]:px-7 min-[420px]:py-4 min-[420px]:text-base md:px-11 md:py-5 md:text-lg"
                >
                    {t("cta_secondary")}
                </Link>
            </div>
        </section>
    );
}
