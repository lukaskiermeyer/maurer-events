import { COMPANY } from "./legal/terms";

// Vollständiger Standard-Vertragstext (Platzhalter + {{#if}}-Blöcke wie in
// lib/contracts.ts renderContract). Wird im Admin-Editor als Starttext und
// vom Retrofit-Skript für bestehende Vorlagen/Verträge verwendet.
// Rechtliche Prüfung durch den Anwalt steht noch aus.
export const DEFAULT_CONTRACT_HTML = `<h2>Arbeitsvertrag</h2>
<p>Zwischen</p>
<p><strong>Maurer Events</strong>, Inhaber ${COMPANY.owner}, ${COMPANY.street}, ${COMPANY.city}, ${COMPANY.email} – nachfolgend „Arbeitgeber“ –</p>
<p>und</p>
<p><strong>{{name}}</strong>, {{adresse}} – nachfolgend „Arbeitnehmer“ –</p>
<p>wird folgender Arbeitsvertrag geschlossen.</p>
<h3>§ 1 Beginn und Art der Tätigkeit</h3>
<p>Das Arbeitsverhältnis beginnt am {{eintritt}}. Der Arbeitnehmer wird als {{rolle}} auf den Volksfesten, Märkten und Veranstaltungen des Arbeitgebers eingesetzt.</p>
<p>Die Tätigkeit umfasst die für diese Rolle üblichen Aufgaben (z. B. Service, Ausschank, Verkauf, Auf- und Abbau) sowie weitere zumutbare Tätigkeiten, die der Festwirt zuweist.</p>
<h3>§ 2 Arbeitszeit und Einsätze</h3>
<p>Die Arbeitszeit richtet sich nach den Öffnungszeiten und dem Veranstaltungsplan des jeweiligen Fests. Die Einsätze werden rechtzeitig über den Dienstplan bekannt gegeben.</p>
<p>Es gelten die gesetzlichen Arbeitszeitgrenzen (ArbZG); Pausen richten sich nach § 4 ArbZG. Überstunden werden nur vergütet oder durch Freizeit ausgeglichen, wenn sie vorher angeordnet wurden.</p>
<h3>§ 3 Vergütung</h3>
{{#if stundensatz}}<p>Der Arbeitnehmer erhält einen Stundenlohn von {{stundensatz}} € brutto. Die Abrechnung erfolgt monatlich auf Basis der dokumentierten Arbeitsstunden.</p>{{/if}}
{{#if gewinnbeteiligung}}<p>Zusätzlich erhält der Arbeitnehmer eine Umsatzbeteiligung von {{gewinnbeteiligung}} % auf den von ihm verantworteten Umsatz der jeweiligen Veranstaltung; die Auszahlung erfolgt mit der Monatsabrechnung.</p>{{/if}}
<p>Sachbezüge (z. B. Verpflegung während der Einsätze) werden nach den gesetzlichen Regelungen behandelt.</p>
<h3>§ 4 Urlaub</h3>
<p>Der Arbeitnehmer hat Anspruch auf den gesetzlichen Mindesturlaub nach dem BUrlG. Der Urlaub wird anteilig nach den tatsächlichen Arbeitstagen berechnet und in Abstimmung mit dem Dienstplan gewährt.</p>
<h3>§ 5 Krankheit und Entgeltfortzahlung</h3>
<p>Bei Arbeitsunfähigkeit gilt die gesetzliche Entgeltfortzahlung (EFZG). Der Arbeitnehmer meldet eine Arbeitsunfähigkeit unverzüglich vor Schichtbeginn und legt ab dem dritten Kalendertag eine ärztliche Bescheinigung vor.</p>
<h3>§ 6 Verschwiegenheit und Datenschutz</h3>
<p>Der Arbeitnehmer behandelt betriebliche Informationen (z. B. Umsätze, Rezepte, interne Abläufe und Preise) vertraulich, auch nach Beendigung des Arbeitsverhältnisses.</p>
<p>Personenbezogene Daten des Arbeitnehmers werden ausschließlich zur Durchführung des Beschäftigungsverhältnisses verarbeitet (Art. 6 Abs. 1 lit. b DSGVO, § 26 BDSG).</p>
<h3>§ 7 Sorgfalt, Haftung und Inventar</h3>
<p>Der Arbeitnehmer geht sorgsam mit Inventar, Waren, Kassensystem und Dienstkleidung um. Für Schäden haftet er nach den Grundsätzen des innerbetrieblichen Schadensausgleichs: bei Vorsatz und grober Fahrlässigkeit voll, bei mittlerer Fahrlässigkeit anteilig.</p>
<h3>§ 8 Nebentätigkeit</h3>
<p>Nebentätigkeiten sind zulässig, solange sie die Tätigkeit für den Arbeitgeber nicht beeinträchtigen und nicht im Wettbewerb zu ihm stehen. Auf Verlangen sind sie anzugeben.</p>
<h3>§ 9 Beendigung des Arbeitsverhältnisses</h3>
<p>Das Arbeitsverhältnis kann mit den gesetzlichen Fristen gekündigt werden (§ 622 BGB), soweit nichts anderes vereinbart ist. Die Kündigung bedarf der Schriftform.</p>
<p>Mit Beendigung sind Inventar, Dienstkleidung, Schlüssel und sonstige Arbeitsmittel vollständig zurückzugeben; die Endabrechnung erfolgt mit der nächsten Monatsabrechnung.</p>
<h3>§ 10 Schlussbestimmungen</h3>
<p>Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform; dies gilt auch für die Aufhebung des Schriftformerfordernisses.</p>
<p>Sollte eine Bestimmung dieses Vertrags unwirksam sein, bleibt der Vertrag im Übrigen wirksam; die Parteien ersetzen die unwirksame Regelung durch eine wirksame, die dem wirtschaftlichen Zweck am nächsten kommt.</p>
<p>Es gilt das Recht der Bundesrepublik Deutschland.</p>
<p>Ort, Datum: {{ort}}, {{heute}}</p>
<p>Unterschrift Arbeitgeber: ____________________</p>
<p>Unterschrift Arbeitnehmer: ____________________</p>`;

// Alte Vorlagen betten das Logo direkt in den editierbaren Text ein – das
// Briefkopf-Logo kommt jetzt aus dem Papier-Layout, Duplikate entfernen.
export function stripEmbeddedLogo(html: string): string {
  return html
    .replace(/<(p|div)[^>]*>\s*<img[^>]*src="\/LogoFinalGrün_MaurerEvents.svg"[^>]*>\s*<\/\1>/gi, "")
    .replace(/<img[^>]*src="\/LogoFinalGrün_MaurerEvents.svg"[^>]*>/gi, "");
}

export function wrapContractPaper(bodyHtml: string): string {
  const body = stripEmbeddedLogo(bodyHtml);
  return `<div class="cp-head">
<img src="/LogoFinalGrün_MaurerEvents.svg" alt="Maurer Events" class="cp-logo" />
<div class="cp-head-meta"><strong>${COMPANY.brand}</strong>Inhaber ${COMPANY.owner}<br/>${COMPANY.street} · ${COMPANY.city}<br/>${COMPANY.email} · maurer-events.com</div>
</div>
<div class="cp-rule" aria-hidden="true"></div>
<div class="cp-body">${body}</div>
<div class="cp-foot"><div class="cp-foot-rule" aria-hidden="true"></div>
<p>${COMPANY.brand} · Inhaber ${COMPANY.owner} · ${COMPANY.street}, ${COMPANY.city} · ${COMPANY.email} · maurer-events.com</p>
</div>`;
}
