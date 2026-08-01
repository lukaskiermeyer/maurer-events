import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  return {
    title: "Karriere bei Maurer Events | Werde Teil des Teams",
    description: "Wir suchen Verstärkung! Bewirb dich jetzt als Servicekraft, Zeltaufbauer oder im Eventmanagement bei Maurer Events.",
  };
}

export default async function KarrierePage() {
  const t = await getTranslations("Navigation");

  return (
    <main className="min-h-screen bg-base-light pt-24 pb-16">
      {/* Hero Section */}
      <section className="max-w-[1200px] mx-auto px-4 text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-black font-display uppercase tracking-tighter mb-6">
          Werde Teil der <span className="text-accent-green">Familie</span>
        </h1>
        <p className="text-lg max-w-2xl mx-auto opacity-80">
          Maurer Events steht für unvergessliche Feste, ausgelassene Stimmung und echte bayerische Gastfreundschaft. 
          Damit das so bleibt, suchen wir motivierte Leute, die anpacken können und Freude am Umgang mit Menschen haben!
        </p>
      </section>

      {/* Jobs */}
      <section className="max-w-[1000px] mx-auto px-4 space-y-8">
        
        {/* Job 1 */}
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-border-light shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-accent-green text-white text-[10px] font-black uppercase px-2 py-1 rounded">Dringend gesucht</span>
                <span className="opacity-50 text-xs font-bold uppercase">Minijob / Teilzeit / Vollzeit</span>
              </div>
              <h2 className="text-3xl font-black font-display mb-3">Servicekräfte (m/w/d)</h2>
              <p className="opacity-80 max-w-xl">
                Du behältst auch bei einem vollen Zelt den Überblick, kannst mehrere Maßkrüge sicher zum Tisch manövrieren und 
                hast immer ein Lächeln auf den Lippen? Dann bist du bei uns genau richtig!
              </p>
              
              <ul className="mt-4 space-y-2 text-sm opacity-80 font-bold">
                <li className="flex items-center gap-2">✓ Übertarifliche Bezahlung + Top Trinkgeld</li>
                <li className="flex items-center gap-2">✓ Flexible Einsatzzeiten (Wochenende/Abends)</li>
                <li className="flex items-center gap-2">✓ Tolles Team & Verpflegung inklusive</li>
              </ul>
            </div>
            
            <a href="mailto:servus@maurer-events.com?subject=Bewerbung%20als%20Servicekraft" className="w-full md:w-auto text-center bg-base-dark text-white font-bold px-8 py-4 rounded-xl hover:bg-accent-green transition-colors">
              Jetzt bewerben
            </a>
          </div>
        </div>

        {/* Job 2 */}
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-border-light shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="opacity-50 text-xs font-bold uppercase">Minijob / Projektbasis</span>
              </div>
              <h2 className="text-3xl font-black font-display mb-3">Zeltaufbau & Logistik (m/w/d)</h2>
              <p className="opacity-80 max-w-xl">
                Du packst gerne mit an, bist handwerklich geschickt und hast kein Problem mit körperlicher Arbeit? 
                Hilf uns dabei, aus einer leeren Wiese eine Party-Location zu zaubern!
              </p>
              
              <ul className="mt-4 space-y-2 text-sm opacity-80 font-bold">
                <li className="flex items-center gap-2">✓ Faire Entlohnung & Bonus bei schnellem Aufbau</li>
                <li className="flex items-center gap-2">✓ Perfekt als Nebenjob für Studenten/Schüler</li>
                <li className="flex items-center gap-2">✓ Starkes Teamgefühl</li>
              </ul>
            </div>
            
            <a href="mailto:servus@maurer-events.com?subject=Bewerbung%20Zeltaufbau" className="w-full md:w-auto text-center bg-base-dark text-white font-bold px-8 py-4 rounded-xl hover:bg-accent-green transition-colors">
              Jetzt bewerben
            </a>
          </div>
        </div>

      </section>

      <section className="max-w-[800px] mx-auto mt-24 text-center px-4">
        <h3 className="text-2xl font-bold font-display mb-4">Nichts Passendes dabei?</h3>
        <p className="opacity-70 mb-8">
          Wir sind immer auf der Suche nach Talenten im Eventmanagement, Marketing oder Technik. 
          Schick uns einfach eine Initiativbewerbung!
        </p>
        <a href="mailto:servus@maurer-events.com" className="inline-block border-2 border-base-dark font-bold px-8 py-3 rounded-xl hover:bg-base-dark hover:text-white transition-colors">
          Initiativbewerbung schreiben
        </a>
      </section>
    </main>
  );
}
