import { Link } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import { ui } from "@/lib/localize";

import { type LegalDocument } from "@/lib/legal/terms";

const others = [
  { slug: 'agb', label: 'AGB' },
  { slug: 'stornobedingungen', label: 'Stornobedingungen' },
  { slug: 'widerruf', label: 'Widerrufsrecht' },
  { slug: 'datenschutz', label: 'Datenschutz' },
  { slug: 'impressum', label: 'Impressum' },
];

// Rechtstexte sind bewusst DE/EN (bar faellt auf DE zurueck); nur die Navigations-
// Chrome wird lokalisiert, der Rechtsinhalt selbst kommt aus den Legal-Datenquellen.
export default async function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const locale = await getLocale();
  const contents = ui(locale, { de: "Inhalt", en: "Contents", bar: "Inhalt" });
  const more = ui(locale, { de: "Weitere Rechtstexte", en: "More legal documents", bar: "Weitere Rechtstexte" });

  return (
    <article className="pt-28 sm:pt-32 pb-16 px-4 sm:px-8 max-w-[1000px] mx-auto min-h-screen">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl text-base-dark break-words">
          {document.title}
        </h1>
        <p className="mt-4 text-base-dark/60 text-sm">{document.updated}</p>

      </header>

      <p className="text-base-dark/80 font-sans leading-relaxed mb-10">{document.intro}</p>

      <nav aria-label={contents} className="bg-canvas-light p-5 sm:p-6 rounded-2xl border border-border-light mb-10">
        <h2 className="font-bold text-lg mb-3">{contents}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 text-sm">
          {document.sections.map(section => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-accent-green underline underline-offset-4 hover:text-base-dark focus-visible:outline-2 focus-visible:outline-offset-4">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10 text-base-dark/80 font-sans leading-relaxed break-words">
        {document.sections.map(section => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28">
            <h2 id={`${section.id}-title`} className="font-display font-bold text-2xl text-base-dark mb-4">{section.title}</h2>
            <div className="space-y-4">
              {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            {section.list && section.list.length > 0 && (
              <ul className="space-y-2 list-disc pl-6">
                {section.list.map(entry => <li key={entry}>{entry}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      <nav aria-label={more} className="mt-16 pt-8 border-t border-border-light">
        <h2 className="font-bold text-lg mb-4">{more}</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {others.filter(entry => entry.slug !== document.slug).map(entry => (
            <li key={entry.slug}>
              <Link href={`/${entry.slug}`} className="text-accent-green underline underline-offset-4 hover:text-base-dark">{entry.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}