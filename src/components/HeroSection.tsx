"use client";

import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import HeroScene from "@/components/HeroScene";

export default function HeroSection() {
    const t = useTranslations("Hero");

    return (
        <section
            id="start"
            className="relative h-[100dvh] min-h-[640px] w-full overflow-hidden bg-[#03497e]"
        >
            <HeroScene />

            {/* Quick-Actions unten mittig in den Nebelwolken (unteres
                Fuenftel) - auch auf Mobile nebeneinander, gross. */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="absolute inset-x-0 bottom-6 z-40 flex flex-row items-center justify-center gap-3 px-3 md:bottom-7 md:gap-4"
            >
                <Link
                    href="/#contact"
                    className="flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-black bg-accent-wood px-5 py-3.5 text-center font-display text-sm font-bold tracking-wide whitespace-nowrap text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-accent-green hover:shadow-xl min-[420px]:px-7 min-[420px]:py-4 min-[420px]:text-base md:px-11 md:py-5 md:text-lg"
                >
                    {t("cta_primary")}
                </Link>
                <Link
                    href="/#events"
                    className="flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-black bg-accent-green px-5 py-3.5 text-center font-display text-sm font-bold tracking-wide whitespace-nowrap text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-base-dark hover:shadow-xl min-[420px]:px-7 min-[420px]:py-4 min-[420px]:text-base md:px-11 md:py-5 md:text-lg"
                >
                    {t("cta_secondary")}
                </Link>
            </motion.div>
        </section>
    );
}
