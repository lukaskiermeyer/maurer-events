"use client";

import { useEffect, useRef, useState } from "react";
import {
    animate,
    motion,
    stagger,
    useReducedMotion,
    useScroll,
    useTransform,
} from "framer-motion";

export default function HeroBackgroundRuntime() {
    const hostRef = useRef<HTMLDivElement>(null);
    const [raw, setRaw] = useState<string | null>(null);
    const reduced = useReducedMotion();

    /* Sanfter Parallax beim Scrollen */
    const { scrollY } = useScroll();
    const y = useTransform(scrollY, [0, 700], [0, 60]);
    const scale = useTransform(scrollY, [0, 700], [1, 1.06]);

    /* SVG laden */
    useEffect(() => {
        let alive = true;
        fetch("/Hintergrund.svg")
            .then((r) => (r.ok ? r.text() : null))
            .then((txt) => alive && txt && setRaw(txt))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    /* SVG normalisieren + Teile animieren */
    useEffect(() => {
        const root = hostRef.current;
        if (!root || !raw) return;

        const svgEl = root.querySelector("svg");
        if (!svgEl) return;

        svgEl.removeAttribute("width");
        svgEl.removeAttribute("height");
        svgEl.setAttribute("preserveAspectRatio", "xMidYMax slice");
        svgEl.style.width = "100%";
        svgEl.style.height = "100%";
        svgEl.style.display = "block";

        if (reduced) return;

        const controls: { stop: () => void }[] = [];
        const q = (sel: string) => Array.from(root.querySelectorAll(sel));
        const centerOrigin = (el: Element) => {
            const e = el as HTMLElement;
            e.style.transformBox = "fill-box";
            e.style.transformOrigin = "center";
        };
        const topOrigin = (el: Element) => {
            const e = el as HTMLElement;
            e.style.transformBox = "fill-box";
            e.style.transformOrigin = "50% 0%";
        };

        /* Riesenrad: endlose Rotation */
        q("#wheel").forEach((el) => {
            centerOrigin(el);
            controls.push(
                animate(el, { rotate: 360 }, { duration: 80, repeat: Infinity, ease: "linear" })
            );
        });

        /* Lichter: gestaffeltes Twinkle */
        const lights = q("#lights circle, #lights ellipse, #lights path");
        if (lights.length) {
            controls.push(
                animate(
                    lights,
                    { opacity: [0.35, 1, 0.35] },
                    { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: stagger(0.18) }
                )
            );
        }

        /* Fenster / Lichterbogen: warmes Pulsieren */
        const windows = q("#windows rect, #windows path, #windows circle");
        if (windows.length) {
            controls.push(
                animate(
                    windows,
                    { opacity: [0.5, 0.9, 0.5] },
                    { duration: 5, repeat: Infinity, ease: "easeInOut", delay: stagger(0.35) }
                )
            );
        }

        /* Nebel: driftet gegengleich */
        q("#fog-1").forEach((el) =>
            controls.push(
                animate(el, { x: [0, 45, 0], opacity: [0.55, 0.85, 0.55] }, { duration: 18, repeat: Infinity, ease: "easeInOut" })
            )
        );
        q("#fog-2").forEach((el) =>
            controls.push(
                animate(el, { x: [0, -55, 0], opacity: [0.5, 0.8, 0.5] }, { duration: 22, repeat: Infinity, ease: "easeInOut" })
            )
        );

        /* Scheinwerfer-Beams: Puls */
        q("#beam-left, #beam-right").forEach((el, i) =>
            controls.push(
                animate(el, { opacity: [0.35, 0.7, 0.35] }, { duration: 6, repeat: Infinity, ease: "easeInOut", delay: i * 0.9 })
            )
        );

        /* Wimpel & Fahnen: wehen */
        q("#bunting, #flags").forEach((el) => {
            topOrigin(el);
            controls.push(
                animate(
                    el,
                    { skewY: [0, 2.5, 0], scaleY: [1, 0.985, 1] },
                    { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
                )
            );
        });

        return () => controls.forEach((c) => c.stop());
    }, [raw, reduced]);

    /* XML-Prolog entfernen (stört innerHTML) */
    const cleaned = raw ? raw.replace(/<\?xml[^>]*\?>/, "").replace(/<!DOCTYPE[^>]*>/i, "") : null;

    return (
        <motion.div
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
        >
            <motion.div className="absolute inset-0" style={{ y, scale }}>
                {/* Fallback-Himmel, solange SVG lädt */}
                {!cleaned && (
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(180deg, #2E4A68 0%, #52708C 40%, #8FA3B5 68%, #C8BFA8 100%)",
                        }}
                    />
                )}
                <div ref={hostRef} className="absolute inset-0" dangerouslySetInnerHTML={cleaned ? { __html: cleaned } : undefined} />
            </motion.div>
        </motion.div>
    );
}