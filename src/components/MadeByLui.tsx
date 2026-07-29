"use client";

import React from 'react';
import SignatureLogo from './SignatureLogo';

export default function MadeByLui({ dark = false }: { dark?: boolean }) {
    // Immer die originale Logofarbe (Rot) nutzen, aber den Text für Dark Mode anpassen
    const signatureColor = '#7f1d1d';
    const labelColor = dark ? 'text-white/60' : 'text-black';

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
                color={signatureColor}
                labelColor={labelColor}
                label="Made by"
            />
        </a>
    );
}
