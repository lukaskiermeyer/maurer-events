import React from "react";



export const metadata = {
  title: "Datenschutz | MAURER EVENTS",
};

export default function DatenschutzPage() {
  return (
    <div className="py-32 px-4 sm:px-8 lg:px-16 max-w-[1200px] mx-auto min-h-screen">
      <h1 className="font-display font-black text-5xl md:text-7xl mb-12 text-base-dark">
        Datenschutz&shy;erklärung
      </h1>

      <div className="prose prose-lg text-base-dark/80 font-sans max-w-none space-y-6">
        
        <div>
          <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">1. Datenschutz auf einen Blick</h2>
          <h3 className="font-display font-bold text-xl text-base-dark mt-4 mb-2">Allgemeine Hinweise</h3>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">2. Allgemeine Hinweise und Pflichtinformationen</h2>
          <h3 className="font-display font-bold text-xl text-base-dark mt-4 mb-2">Datenschutz</h3>
          <p>
            Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
          </p>
          
          <h3 className="font-display font-bold text-xl text-base-dark mt-6 mb-2">Hinweis zur verantwortlichen Stelle</h3>
          <p>
            Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
          </p>
          <p className="mt-2 bg-canvas-light p-4 rounded-xl border border-border-light inline-block">
            Florian Maurer<br />
            Maurer Events<br />
            Schwaiger Str. 6<br />
            85126 Müchsmünster<br /><br />
            {/* TODO: Telefon: Wird zeitnah ergänzt */}
            E-Mail: servus@maurer-events.com
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">3. Datenerfassung auf dieser Website</h2>
          <h3 className="font-display font-bold text-xl text-base-dark mt-4 mb-2">Kontaktformular</h3>
          <p>
            Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">4. Speicherdauer von Reservierungen und Tickets</h2>
          <p>
            Wenn Sie über unsere Plattform eine Tischreservierung tätigen oder Tickets für eine Veranstaltung erwerben, speichern wir die von Ihnen eingegebenen Daten (insb. Name, E-Mail-Adresse, Anzahl der Gäste, Reservierungszeitpunkt, Zahlungsstatus) zur Erfüllung des Vertrags gem. Art. 6 Abs. 1 lit. b DSGVO.
          </p>
          <p className="mt-2">
            Nach Abschluss der Veranstaltung werden Ihre Reservierungs- und Ticketdaten noch im Rahmen der gesetzlichen Aufbewahrungsfristen (insb. steuer- und handelsrechtliche Aufbewahrungsfristen, z.B. 10 Jahre für Rechnungsbelege) gespeichert und anschließend gelöscht, sofern Sie nicht in eine längere Speicherung eingewilligt haben.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-base-dark mt-8 mb-4">5. Eingesetzte Dienste und Subprozessoren</h2>
          <p>
            Zur Bereitstellung unserer Webseite und Dienstleistungen nutzen wir folgende Drittanbieter (Subprozessoren), an die im Rahmen der Auftragsverarbeitung oder Vertragserfüllung Daten übermittelt werden können:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li><strong>Cloudflare:</strong> Hosting, Content Delivery Network (CDN), DDoS-Schutz und Spam-Schutz durch Cloudflare Turnstile.</li>
            <li><strong>Neon:</strong> Hosting unserer PostgreSQL Datenbank zur sicheren Speicherung von Reservierungsdaten.</li>
            <li><strong>Stripe:</strong> Sichere Abwicklung von Zahlungen bei kostenpflichtigen Reservierungen.</li>
            <li><strong>Resend:</strong> Versand von Transaktions-E-Mails (z.B. Reservierungsbestätigungen und digitale Tickets).</li>
            <li><strong>Vercel Blob:</strong> Cloud-Speicherung für hochgeladene Medien und Bilder.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
