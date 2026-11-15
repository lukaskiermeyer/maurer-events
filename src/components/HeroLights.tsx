"use client";

import { useReducedMotion } from "framer-motion";
import type { HeroLight } from "@/components/heroLightPoints";

/* Sanftes Funkeln ueber den gezeichneten Gluehbirnen einer Stage-Box.
   Die Punkte liegen prozentgenau auf den Birnen des SVGs und blenden nur in der
   Helligkeit - deshalb bleibt das zentrierende CSS-Transform unangetastet.
   CSS-Animation statt framer-motion, damit die Animation auf dem Compositor
   laeuft (vermeidet "nicht zusammengesetzte Animationen"). */
export default function HeroLights({ lights }: { lights: HeroLight[] }) {
    const reduced = useReducedMotion();

    return (
        <>
            {lights.map((light, i) => {
                const duration = 2.6 + (i % 4) * 0.55;
                const delay = (i * 0.37) % 2.3;
                return (
                    <span
                        key={`${light.x}-${light.y}`}
                        className="hero-light"
                        style={{
                            left: `${light.x}%`,
                            top: `${light.y}%`,
                            width: `${(light.r * 2.4).toFixed(3)}%`,
                            opacity: reduced ? 0.5 : undefined,
                            animation: reduced
                                ? "none"
                                : `hero-twinkle ${duration}s ease-in-out ${delay}s infinite`,
                        }}
                    />
                );
            })}
        </>
    );
}