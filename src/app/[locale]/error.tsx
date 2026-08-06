"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/routing";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-base-dark flex flex-col items-center justify-center text-canvas-light p-4 text-center">
      <div className="max-w-md">
        <h2 className="text-4xl font-display font-black text-red-500 mb-4">Hoppla!</h2>
        <p className="text-lg opacity-70 mb-8 font-sans">
          Da ist leider etwas schiefgelaufen. Bitte versuche es noch einmal oder kehre zur Startseite zurück.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="bg-accent-green text-base-dark font-bold px-6 py-3 rounded-xl hover:bg-white transition-colors"
          >
            Nochmal versuchen
          </button>
          <Link 
            href="/"
            className="border border-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
