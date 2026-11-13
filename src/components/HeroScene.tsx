import Image from "next/image";
import HeroPubSign from "@/components/HeroPubSign";
import HeroLights from "@/components/HeroLights";
import { gateGarlandLights, tentLights } from "@/components/heroLightPoints";

/* Illustrierte Festzelt-Szene, Layer-Reihenfolge von hinten nach vorne:
   Himmel > Boden (CSS-Planken, .hero-ground) > Zelt > Schild > Eingang.
   Boden.svg und das Riesenrad werden nicht mehr verwendet - der Boden
   ist die CSS-Plankenflaeche. */
export default function HeroScene() {
    return (
        <div className="hero-scene pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="hero-sky">
                <Image
                    src="/Himmel.svg"
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover object-[center_32%]"
                />
            </div>

            <div className="hero-ground" />

            <div className="hero-stage hero-tent z-[4]">
                <Image src="/Zelt.svg" alt="" fill sizes="100vw" />
                <HeroLights lights={tentLights} />
            </div>

            <HeroPubSign />

            <div className="hero-stage hero-gate z-[6]">
                <Image src="/Eingang.svg" alt="" fill sizes="100vw" />
                <HeroLights lights={gateGarlandLights} />
            </div>
        </div>
    );
}
