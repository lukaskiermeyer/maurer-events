import { Inter } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';



const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "MAURER EVENTS | Moderne bayerische Gastfreundschaft",
  description: "Erlebe modernste Events mit bayerischem Herz. Wir organisieren Zeltfeste, Firmenevents und vieles mehr in München und Umgebung.",
  keywords: ["Events", "München", "Zeltfest", "Bayerisch", "Maurer Events", "Catering", "Gastronomie"],
  authors: [{ name: "Maurer Events" }],
  creator: "Maurer Events",
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "https://maurer-events.de",
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
  "image": "https://maurer-events.de/logo.png",
  "@id": "https://maurer-events.de",
  "url": "https://maurer-events.de",
  "telephone": "+49123456789",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Musterstraße 1",
    "addressLocality": "München",
    "postalCode": "80331",
    "addressCountry": "DE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 48.1351,
    "longitude": 11.5820
  },
  "sameAs": [
    "https://instagram.com/maurer-events"
  ]
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased scroll-smooth`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-base-light text-base-dark">
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
