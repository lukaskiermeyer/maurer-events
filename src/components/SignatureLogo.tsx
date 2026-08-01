"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

interface SignatureLogoProps {
  animated?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  forceLabelColor?: "light" | "dark";
}

const SignatureLogo: React.FC<SignatureLogoProps> = ({
  animated = false,
  className = "",
  size = "md",
  label = "Made by",
  forceLabelColor,
}) => {
  // Varianten für den Zeichen-Effekt
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

  // Varianten für "Sofort da" (wenn animated = false)
  const staticVariants: Variants = {
    hidden: { pathLength: 1, opacity: 1 },
    visible: { pathLength: 1, opacity: 1 },
  };

  const scale = size === "sm" ? 0.62 : size === "lg" ? 1.6 : size === "xl" ? 2.35 : 1;
  const width = 92 * scale;
  const height = 44 * scale;

  const labelClass =
    forceLabelColor === "light"
      ? "text-white"
      : forceLabelColor === "dark"
      ? "text-black"
      : "text-black";

  // Wähle die richtigen Varianten basierend auf dem Prop
  const activeVariants = animated ? pathVariants : staticVariants;

  return (
    <div className={`flex flex-col items-start leading-none select-none ${className}`}>
      <span className={`font-sans tracking-tight ${forceLabelColor === "light" ? "text-white" : "text-black"} ${size === "xl" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs"}`}>
        {label}
      </span>

      <div className="relative -mt-1" style={{ width, height }}>
        <svg width="100%" height="100%" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
          {/* Der "L"-Schwung */}
          <motion.path
            d="M10 10 C 15 5, 20 5, 20 20 C 20 40, 10 40, 30 40 C 40 40, 40 25, 40 25 C 40 25, 40 35, 45 35 C 50 35, 50 25, 50 25 C 50 25, 50 35, 55 35 C 60 35, 65 30, 65 25"
            stroke="var(--brand)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial="hidden"
            animate="visible"
            variants={animated ? pathVariants : staticVariants}
          />
          {/* Der Punkt */}
          <motion.circle
            cx="65"
            cy="15"
            r="2.5"
            fill="var(--brand)"
            initial={animated ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={animated ? { delay: 2.0, duration: 0.25 } : { duration: 0 }}
          />
        </svg>
      </div>
    </div>
  );
};

export default SignatureLogo;