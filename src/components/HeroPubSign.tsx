"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/* Pubschild pendelt sanft am Aufhängepunkt unter dem Querbalken. */
export default function HeroPubSign() {
    const reduced = useReducedMotion();

    return (
        <div className="hero-sign">
            <motion.div
                className="hero-sign-frame"
                style={{ transformOrigin: "50% 8.8%" }}
                animate={reduced ? undefined : { rotate: [-2.2, 2.2, -2.2] }}
                transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
            >
                <Image src="/PubSchild.svg" alt="" fill sizes="(max-aspect-ratio: 1/1) 84vw, 60vh" />
            </motion.div>
        </div>
    );
}
