import React from "react";



export const metadata = {
  title: "Impressum | MAURER EVENTS",
};

export default function ImpressumPage() {
  return (
    <div className="py-32 px-4 sm:px-8 lg:px-16 max-w-[1200px] mx-auto min-h-screen">
      <h1 className="font-display font-black text-5xl md:text-7xl mb-12 text-base-dark">
        Impressum
      </h1>

      <div className="prose prose-lg text-base-dark/80 font-sans max-w-none">
        <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">Angaben gemäß § 5 TMG</h2>
        <p>
          Maurer Events<br />
          Schwaiger Str. 6<br />
          85126 Müchsmünster
        </p>

        <p>
          <strong>Vertreten durch:</strong><br />
          Geschäftsführer: Florian Maurer
        </p>

        <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">Kontakt</h2>
        <p>
          E-Mail: servus@maurer-events.com<br />
          Internet: maurer-events.com
        </p>

        <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">Registereintrag</h2>
        <p>
          Registergericht: Amtsgericht München
        </p>

        <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">Umsatzsteuer-ID</h2>
        <p>
          Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
          DE 453 682 944
        </p>

        <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">Steuernummer</h2>
        <p>
          154/248/60236<br />
          Finanzamt Pfaffenhofen
        </p>

        <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">Verbraucherstreitbeilegung/Universalschlichtungsstelle</h2>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </div>
    </div>
  );
}
