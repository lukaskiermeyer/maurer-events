"use client";

import { useEffect, useRef, useState } from "react";
import {
    animate,
    motion,
    stagger,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion";

const FLAG_SELECTOR = [
    'path[style*="#2779af"]',
    'path[style*="#277bb1"]',
    'path[style*="#287bb2"]',
    'path[style*="#297ab0"]',
    'path[style*="#297ab1"]',
].join(", ");

const FOG_SELECTOR = [
    'path[style*="#739caa"]',
    'path[style*="#729caa"]',
    'path[style*="#96b5bc"]',
    'path[style*="#93b6c1"]',
    'path[style*="#76a4b2"]',
    'path[style*="#6498ab"]',
].join(", ");

export default function HeroBackground() {
    const hostRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const reduced = useReducedMotion();

    /* Sanfter Parallax: Szene zieht beim Scrollen leicht nach */
    const { scrollY } = useScroll();
    const y = useSpring(useTransform(scrollY, [0, 800], [0, 70]), {
        stiffness: 60,
        damping: 20,
    });
    const scale = useTransform(scrollY, [0, 800], [1.05, 1.12]);

    useEffect(() => {
        let alive = true;
        fetch("/Hintergrund.svg")
            .then((r) => (r.ok ? r.text() : null))
            .then((txt) => {
                if (!alive || !txt) return;
                setSvg(txt.replace(/<\?xml[^>]*\?>/, "").replace(/<!DOCTYPE[^>]*>/i, ""));
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        const root = hostRef.current;
        if (!root || !svg) return;

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

        /* Lichter: jedes Circle ist eine Birne -> gestaffeltes Twinkle */
        const lights = Array.from(root.querySelectorAll("circle"));
        if (lights.length) {
            controls.push(
                animate(
                    lights,
                    { opacity: [0.35, 1, 0.35] },
                    { duration: 2.8, ease: "easeInOut", repeat: Infinity, delay: stagger(0.07) }
                )
            );
        }

        /* Flaggen: wehen leicht */
        const flags = Array.from(root.querySelectorAll(FLAG_SELECTOR));
        flags.forEach((el, i) => {
            const e = el as HTMLElement;
            e.style.transformBox = "fill-box";
            e.style.transformOrigin = "0% 0%";
            controls.push(
                animate(
                    el,
                    { skewY: [0, 3, 0], scaleY: [1, 0.98, 1] },
                    { duration: 4 + (i % 3) * 0.7, ease: "easeInOut", repeat: Infinity, delay: i * 0.35 }
                )
            );
        });

        /* Nebel-Hügel: driften gegengleich */
        const fog = Array.from(root.querySelectorAll(FOG_SELECTOR));
        fog.forEach((el, i) => {
            controls.push(
                animate(
                    el,
                    { x: [0, i % 2 ? -16 : 16, 0], opacity: [0.85, 1, 0.85] },
                    { duration: 16 + i * 3, ease: "easeInOut", repeat: Infinity }
                )
            );
        });

        /* Riesenrad: Versuche es zu finden und zu rotieren */
        /* Strategie 1: Suche nach ID */
        let wheel = root.querySelector("#wheel, #riesenrad, #ferris-wheel, #rad");

        /* Strategie 2: Suche nach einem <g> Element, das viele radiale Linien enthält */
        if (!wheel) {
            const groups = Array.from(root.querySelectorAll("g"));
            wheel = groups.find(g => {
                const lines = g.querySelectorAll("line");
                const circles = g.querySelectorAll("circle");
                /* Riesenrad hat typischerweise viele radiale Linien + konzentrische Kreise */
                return lines.length >= 8 && circles.length >= 2;
            });
        }

        /* Strategie 3: Suche nach einem großen Kreis mit vielen kleineren Kreisen drumherum */
        if (!wheel) {
            const allCircles = Array.from(root.querySelectorAll("circle"));
            const largeCircles = allCircles.filter(c => {
                const r = parseFloat(c.getAttribute("r") || "0");
                return r > 30; /* Großer Kreis */
            });

            if (largeCircles.length > 0) {
                /* Nimm den größten Kreis und sein Parent-<g> */
                const largestCircle = largeCircles.reduce((prev, curr) => {
                    const prevR = parseFloat(prev.getAttribute("r") || "0");
                    const currR = parseFloat(curr.getAttribute("r") || "0");
                    return currR > prevR ? curr : prev;
                });

                wheel = largestCircle.closest("g") || largestCircle.parentElement;
            }
        }

        if (wheel) {
            const e = wheel as HTMLElement;
            e.style.transformBox = "fill-box";
            e.style.transformOrigin = "center";
            controls.push(
                animate(
                    wheel,
                    { rotate: 360 },
                    { duration: 80, ease: "linear", repeat: Infinity }
                )
            );
        }

        return () => controls.forEach((c) => c.stop());
    }, [svg, reduced]);

    return (
        <motion.div className="absolute inset-0" style={{ y, scale }}>
            <div
                ref={hostRef}
                className="absolute inset-0"
                dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
            />
        </motion.div>
    );
}