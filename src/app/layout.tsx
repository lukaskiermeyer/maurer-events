import localFont from "next/font/local";
import { Dancing_Script } from "next/font/google";
import "./globals.css";
import { getLocale } from 'next-intl/server';

// Styleguide Kunde: Fließtext + Hauptüberschriften in Aileron (All Capitals, Bold, Laufweite -75),
// Unterüberschriften in Yeseva One. Aileron ist nicht auf Google Fonts und wird self-hosted
// (woff2, latin, CC0-Lizenz siehe fonts/LICENSE-aileron.txt).
const aileron = localFont({
  src: [
    { path: "./fonts/aileron-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/aileron-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/aileron-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/aileron-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-aileron",
  display: "swap",
});

const yesevaOne = localFont({
  // Verlustfrei aus der beibehaltenen TTF-Quelle komprimiert (Glyphen verifiziert).
  src: "../../public/fonts/YesevaOne-Regular.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-yeseva",
  display: "swap",
});

// Dekorativer Handschrift-Akzent (Polaroid-Unterschriften, kein Bestandteil des
// Styleguides - bewusst nur für Deko-Elemente). Variable Font, self-hosted via next/font.
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  display: "swap",
});

import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL("https://maurer-events.com"),
  alternates: {
    canonical: '/',
  },
  title: "MAURER EVENTS | Moderne bayerische Gastfreundschaft",
  description: "Erlebe modernste Events mit bayerischem Herz. Wir organisieren Zeltfeste, Firmenevents und vieles mehr in Ingolstadt, Eichstätt, München und Umgebung.",
  keywords: ["Events", "München", "Müchsmünster", "Zeltfest", "Bayerisch", "Maurer Events", "Catering", "Gastronomie"],
  authors: [{ name: "Maurer Events" }],
  creator: "Maurer Events",
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: ["en_US"],
    url: "https://maurer-events.com",
    title: "MAURER EVENTS",
    description: "Modern Events. Bavarian Heart.",
    siteName: "Maurer Events",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Maurer Events - Zeltfest und Catering",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MAURER EVENTS",
    description: "Modern Events. Bavarian Heart.",
    images: ["/og-image.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Maurer Events",
  "image": "https://maurer-events.com/og-image.jpg",
  "@id": "https://maurer-events.com",
  "url": "https://maurer-events.com",
  "email": "servus@maurer-events.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Schwaiger Str. 6",
    "addressLocality": "Müchsmünster",
    "postalCode": "85126",
    "addressCountry": "DE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 48.7618,
    "longitude": 11.6781
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "München"
    },
    {
      "@type": "City",
      "name": "Ingolstadt"
    },
    {
      "@type": "City",
      "name": "Eichstätt"
    },
    {
      "@type": "City",
      "name": "Müchsmünster"
    },
    {
      "@type": "City",
      "name": "Regensburg"
    },
    {
      "@type": "City",
      "name": "Pfaffenhofen"
    }
  ],
  "sameAs": [
    "https://www.instagram.com/damaurerwirt",
    "https://www.tiktok.com/@damaurerwirt"
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${aileron.variable} ${yesevaOne.variable} ${dancingScript.variable} h-full antialiased scroll-smooth`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        <meta name="geo.region" content="DE-BY" />
        <meta name="geo.placename" content="Müchsmünster" />
        <meta name="geo.position" content="48.7618;11.6781" />
        <meta name="ICBM" content="48.7618, 11.6781" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-base-light text-base-dark" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
