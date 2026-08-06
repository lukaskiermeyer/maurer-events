"use client";

import React from "react";
import SignatureLogo from "./SignatureLogo";

export default function MadeByLui({ dark = false }: { dark?: boolean }) {
  // Dein Brand-Rot (#7f1d1d) für den hellen Modus, Weiß für den dunklen Footer
  const signatureColor = "#7f1d1d";

  return (
      <a
          href="https://madebylui.net"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-block no-underline opacity-80 hover:opacity-100 transition-opacity"
          aria-label="Website built by Lui"
      >
        <SignatureLogo
            animated={true}
            size="sm"
            forceLabelColor={dark ? "light" : "dark"}
            color={signatureColor}
            label="Made by"
        />
      </a>
  );
}