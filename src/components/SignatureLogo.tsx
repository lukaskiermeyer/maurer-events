"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

interface SignatureLogoProps {
  animated?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  forceLabelColor?: "light" | "dark";
  color?: string; // Farbe für den SVG-Pfad wieder hinzugefügt
}

const SignatureLogo: React.FC<SignatureLogoProps> = ({
                                                       animated = false,
                                                       className = "",
                                                       size = "md",
                                                       label = "Made by",
                                                       forceLabelColor,
                                                       color = "#1F5732", // Fallback-Farbe (z.B. dein accent-green oder schwarz)
                                                     }) => {
  const pathVariants: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        duration: 2.3,
        ease: [0.42, 0, 0.58, 1],
        delay: 0.15,
      },
    },
  };

  const staticVariants: Variants = {
    hidden: { pathLength: 1, opacity: 1 },
    visible: { pathLength: 1, opacity: 1 },
  };

  const scale = size === "sm" ? 0.62 : size === "lg" ? 1.6 : size === "xl" ? 2.35 : 1;
  const width = 92 * scale;
  const height = 44 * scale;

  const activeVariants = animated ? pathVariants : staticVariants;

  return (
      <div className={`flex flex-col items-start leading-none select-none ${className}`}>
      <span className={`font-sans tracking-tight ${forceLabelColor === "light" ? "text-white" : "text-black"} ${size === "xl" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs"}`}>
        {label}
      </span>

        <div className="relative -mt-1" style={{ width, height }}>
          <svg width="100%" height="100%" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
            <motion.path
                d="M10 10 C 15 5, 20 5, 20 20 C 20 40, 10 40, 30 40 C 40 40, 40 25, 40 25 C 40 25, 40 35, 45 35 C 50 35, 50 25, 50 25 C 50 25, 50 35, 55 35 C 60 35, 65 30, 65 25"
                stroke={color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.5 }}
                variants={activeVariants}
            />
            <motion.circle
                cx="65"
                cy="15"
                r="2.5"
                fill={color}
                initial={animated ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={animated ? { delay: 2.0, duration: 0.25 } : { duration: 0 }}
            />
          </svg>
        </div>
      </div>
  );
};

export default SignatureLogo;