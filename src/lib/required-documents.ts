// mapping zwischen frei benannten Pflichtdokumenten der Rolle (Admin-Chips)
// und den Upload-Arten (staff_documents.kind) im Onboarding.
import { DOCUMENT_KINDS } from "./file-types";

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  id_card: "Ausweis",
  health_certificate: "Gesundheitszeugnis",
  tax_card: "Steuerkarte",
  minijob_form: "Minijob-Formular",
  other: "Sonstiges",
};

function normalizeLabel(label: string) {
  return label
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Admin-Chips (und alte Freitexteingaben) auf Upload-Arten abbilden.
const LABEL_TO_KIND: Record<string, string> = {
  "ausweis": "id_card",
  "personalausweis": "id_card",
  "gesundheitszeugnis": "health_certificate",
  "gesundheitszeugnis mehrseitiges bescheinigung gesundheitsamt": "health_certificate",
  "steuerkarte": "tax_card",
  "minijob-formular": "minijob_form",
  "minijob formular": "minijob_form",
};

export function kindForRequiredDoc(label: string): string {
  const kind = LABEL_TO_KIND[normalizeLabel(label)];
  return kind && DOCUMENT_KINDS.has(kind) ? kind : "other";
}

export type DocumentState = "done" | "missing" | "rejected";

export type RequiredDocStatus = {
  label: string;
  kind: string;
  state: DocumentState;
};

export type DocInfo = { title: string; text: string };

function docInfo(title: string, text: string): DocInfo {
  return { title, text };
}

// Wo bekommt man das Dokument her? Nach normalisiertem Label, mit Arten-Fallback.
const DOC_INFO: Record<string, DocInfo> = {
  "ausweis": docInfo("Personalausweis", "Beim Bürgeramt deiner Wohngemeinde beantragen (ca. 30 €, 1–2 Wochen). Ein gültiger Reisepass geht auch. Foto/PDF genügt."),
  "personalausweis": docInfo("Personalausweis", "Beim Bürgeramt deiner Wohngemeinde beantragen (ca. 30 €, 1–2 Wochen). Ein gültiger Reisepass geht auch. Foto/PDF genügt."),
  "gesundheitszeugnis": docInfo("Gesundheitszeugnis (§ 43 IfSG)", "Pflicht für Tätigkeiten mit Lebensmitteln. Beim Gesundheitsamt deines Landkreises beantragen (ca. 20–50 €, ~2 Wochen, kurze Einweisung vor Ort). Zum Termin Ausweis mitbringen."),
  "steuerkarte": docInfo("Steuerkarte / Steuer-ID", "Hast du automatisch vom Finanzamt erhalten. Ersatz gibt es beim Finanzamt des Wohnsitzes oder online über ELSTER („Meine Steuern“)."),
  "minijob-formular": docInfo("Minijob-Formular", "Wird von uns automatisch aus deinen gerade angegebenen Daten erstellt und gespeichert. Keine extra Datei nötig – einfach deine Daten oben speichern."),
  "minijob formular": docInfo("Minijob-Formular", "Wird von uns automatisch aus deinen gerade angegebenen Daten erstellt und gespeichert. Keine extra Datei nötig – einfach deine Daten oben speichern."),
  "arbeitszeugnis": docInfo("Arbeitszeugnis", "Bei deinem letzten Arbeitgeber anfordern (einfaches Arbeitszeugnis reicht). Schriftlich per Brief oder E-Mail; Anspruch besteht nach Beendigung des Arbeitsverhältnisses."),
  "fuhrerschein": docInfo("Führerschein", "Beim Amt für Fahrerlaubniswesen ausgestellt. Falls vorhanden, reicht eine Kopie/Scan."),
};

const KIND_DEFAULT_INFO: Record<string, DocInfo> = {
  id_card: docInfo("Ausweis", "Beim Bürgeramt deiner Wohngemeinde beantragen (ca. 30 €, 1–2 Wochen). Ein gültiger Reisepass geht auch."),
  health_certificate: docInfo("Gesundheitszeugnis (§ 43 IfSG)", "Beim Gesundheitsamt deines Landkreises beantragen (ca. 20–50 €, ~2 Wochen, kurze Einweisung vor Ort)."),
  tax_card: docInfo("Steuerkarte / Steuer-ID", "Hast du automatisch vom Finanzamt erhalten. Ersatz gibt es dort oder online über ELSTER."),
  minijob_form: docInfo("Minijob-Formular", "Wird von uns automatisch aus deinen gerade angegebenen Daten erstellt und gespeichert. Keine extra Datei nötig – einfach deine Daten oben speichern."),
  other: docInfo("Dokument", "Lade ein Foto oder PDF hoch. Im Zweifel frag den Festwirt, was genau er braucht."),
};

export function docInfoFor(label: string, kind: string): DocInfo {
  return DOC_INFO[normalizeLabel(label)] ?? KIND_DEFAULT_INFO[kind] ?? KIND_DEFAULT_INFO["other"];
}

export function resolveRequiredDocs(
  requiredDocuments: string[],
  uploaded: Array<{ kind: string; status: string }>,
): RequiredDocStatus[] {
  return requiredDocuments
    .map(label => label.trim())
    .filter(Boolean)
    .map(label => {
      const kind = kindForRequiredDoc(label);
      const matches = uploaded.filter(doc => doc.kind === kind);
      const valid = matches.some(doc => doc.status !== "rejected");
      const rejected = matches.length > 0 && !valid;
      return {
        label,
        kind,
        state: valid ? ("done" as const) : rejected ? ("rejected" as const) : ("missing" as const),
      };
    });
}
