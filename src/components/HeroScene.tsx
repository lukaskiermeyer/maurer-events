"use client";

import { useState } from "react";
import Image from "next/image";
import HeroPubSign from "@/components/HeroPubSign";
import HeroLights from "@/components/HeroLights";
import { gateGarlandLights, tentLights } from "@/components/heroLightPoints";

/* Illustrierte Festzelt-Szene, Layer-Reihenfolge von hinten nach vorne:
   Himmel > Boden (CSS-Planken, .hero-ground) > Zelt > Schild > Eingang.
   Boden.svg und das Riesenrad werden nicht mehr verwendet - der Boden
   ist die CSS-Plankenflaeche. Die Lichterketten werden erst eingeblendet,
   sobald das jeweilige Bild (Zelt / Eingang) geladen ist, damit sie nicht
   vor dem Zelt aufblitzen. */
export default function HeroScene() {
    const [tentReady, setTentReady] = useState(false);
    const [gateReady, setGateReady] = useState(false);

    return (
        <div className="hero-scene pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="hero-sky">
                <Image
                    src="/Himmel.svg"
                    alt=""
                    fill
                    sizes="100vw"
                    priority
                    fetchPriority="high"
                    draggable={false}
                    className="object-cover object-[center_32%]"
                />
            </div>

            <div className="hero-ground" />

            <div className="hero-stage hero-tent z-[4]">
                <Image
                    src="/Zelt.svg"
                    alt=""
                    fill
                    sizes="100vw"
                    priority
                    draggable={false}
                    onLoad={() => setTentReady(true)}
                />
                {tentReady && <HeroLights lights={tentLights} />}
            </div>

            <div className="hero-fog" />

            <HeroPubSign />

            <div className="hero-stage hero-gate z-[6]">
                <Image
                    src="/Eingang.svg"
                    alt=""
                    fill
                    sizes="100vw"
                    draggable={false}
                    onLoad={() => setGateReady(true)}
                />
                {gateReady && <HeroLights lights={gateGarlandLights} />}
            </div>
        </div>
    );
}