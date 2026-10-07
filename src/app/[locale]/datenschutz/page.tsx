import type { Metadata } from 'next';
import { privacyNotices } from '@/lib/privacy-notice';

type Props = { params: Promise<{ locale: string }> };

async function getNotice(params: Props['params']) {
  const { locale } = await params;
  return privacyNotices[locale === 'en' ? 'en' : 'de'];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const notice = await getNotice(params);
  return {
    title: `${notice.title} | MAURER EVENTS`, description: notice.description,
    alternates: {
      canonical: notice === privacyNotices.en ? '/en/datenschutz' : '/datenschutz',
      languages: { de: '/datenschutz', en: '/en/datenschutz' },
    },
  };
}

export default async function DatenschutzPage({ params }: Props) {
  const notice = await getNotice(params);

  return (
    <article className="pt-28 sm:pt-32 pb-16 px-4 sm:px-8 max-w-[1000px] mx-auto min-h-screen">
      <header className="mb-8 sm:mb-12">
        <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl text-base-dark break-words [hyphens:manual]">
          {notice === privacyNotices.de ? <>Datenschutz&shy;erklärung</> : notice.title}
        </h1>
        <p className="mt-4 text-base-dark/60 text-sm">{notice.updated}</p>
      </header>

      <nav aria-label={notice.contents} className="bg-canvas-light p-5 sm:p-6 rounded-2xl border border-border-light mb-10">
        <h2 className="font-bold text-lg mb-3">{notice.contents}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 text-sm">
          {notice.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="text-accent-green underline underline-offset-4 hover:text-base-dark focus-visible:outline-2 focus-visible:outline-offset-4">{section.title}</a></li>)}
        </ol>
      </nav>

      <div className="space-y-10 text-base-dark/80 font-sans leading-relaxed break-words">
        {notice.sections.map(section => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28">
            <h2 id={`${section.id}-title`} className="font-display font-bold text-2xl text-base-dark mb-4">{section.title}</h2>
            <div className="space-y-4">{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

            {section.id === 'verantwortlich' && (
              <address className="mt-5 bg-canvas-light p-5 rounded-xl border border-border-light not-italic">
                <p className="font-bold text-base-dark">Florian Maurer · Maurer Events</p>
                <p>Schwaiger Str. 6<br />85126 Müchsmünster<br />{notice.country}</p>
                <p className="mt-3 text-sm">{notice.contactLabel}</p>
                <a href="mailto:servus@maurer-events.com" className="text-accent-green underline underline-offset-4">servus@maurer-events.com</a>
              </address>
            )}

            {section.id === 'browser-speicher' && (
              <div className="mt-5">
                <dl className="space-y-4 md:hidden">
                  {notice.storage.map(entry => <div key={entry.name} className="rounded-xl border border-border-light p-4 space-y-2 text-sm">
                    <dt className="font-bold text-base-dark [overflow-wrap:anywhere]">{entry.name}</dt>
                    <dd>{entry.purpose}</dd>
                    <dd className="text-base-dark/60">{entry.duration}</dd>
                  </div>)}
                </dl>
                <table className="hidden md:table w-full text-sm text-left border border-border-light">
                  <thead className="bg-canvas-light text-base-dark"><tr>{notice.storageHeaders.map(label => <th key={label} scope="col" className="p-4 align-top">{label}</th>)}</tr></thead>
                  <tbody>{notice.storage.map(entry => <tr key={entry.name} className="border-t border-border-light align-top">
                    <th scope="row" className="p-4 font-bold [overflow-wrap:anywhere]">{entry.name}</th>
                    <td className="p-4">{entry.purpose}</td><td className="p-4">{entry.duration}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}

            {section.links && <ul className="mt-5 space-y-2 text-sm">{section.links.map(link => <li key={link.href}><a href={link.href} className="text-accent-green underline underline-offset-4 hover:text-base-dark">{link.label}</a></li>)}</ul>}
          </section>
        ))}
      </div>
    </article>
  );
}
