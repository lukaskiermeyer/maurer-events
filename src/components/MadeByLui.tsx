"use client";

import React from "react";
import SignatureLogo from "./SignatureLogo";

export default function MadeByLui({ dark = false }: { dark?: boolean }) {
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
        label="Made by"
      />
    </a>
  );
}