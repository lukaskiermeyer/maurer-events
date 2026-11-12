"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HeroLight } from "@/components/heroLightPoints";

/* Sanftes Funkeln ueber den gezeichneten Gluehbirnen einer Stage-Box.
   Die Punkte liegen prozentgenau auf den Birnen des SVGs und blenden nur in der
   Helligkeit - deshalb bleibt das zentrierende CSS-Transform unangetastet. */
export default function HeroLights({ lights }: { lights: HeroLight[] }) {
    const reduced = useReducedMotion();

    return (
        <>
            {lights.map((light, i) => (
                <motion.span
                    key={`${light.x}-${light.y}`}
                    className="hero-light"
                    style={{ left: `${light.x}%`, top: `${light.y}%`, width: `${(light.r * 2.4).toFixed(3)}%` }}
                    animate={reduced ? { opacity: 0.5 } : { opacity: [0.2, 0.85, 0.2] }}
                    transition={
                        reduced
                            ? { duration: 0 }
                            : {
                                  duration: 2.6 + (i % 4) * 0.55,
                                  ease: "easeInOut",
                                  delay: (i * 0.37) % 2.3,
                                  repeat: Infinity,
                              }
                    }
                />
            ))}
        </>
    );
}
