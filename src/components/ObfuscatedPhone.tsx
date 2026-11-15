"use client";

// Telefonnummer wird erst clientseitig aus Einzelteilen zusammengesetzt,
// damit sie nicht als Klartext im initialen HTML/SSR-Markup steht.
const PARTS = ["+49", " ", "162", " ", "587", " ", "5930"];

export default function ObfuscatedPhone() {
    const number = PARTS.join("");
    const tel = `tel:${number.replace(/\s/g, "")}`;
    return (
        <a
            href={tel}
            className="text-accent-green underline underline-offset-4 hover:text-base-dark"
            rel="nofollow"
        >
            {number}
        </a>
    );
}