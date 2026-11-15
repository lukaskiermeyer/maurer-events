"use client";

import { useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { saveMyOnboarding } from "@/app/actions/staff";
import { deleteMyDocument } from "@/app/actions/staff";
import { PRIVACY_VERSION } from "@/lib/privacy-version";
import { DOCUMENT_KIND_LABELS, docInfoFor, resolveRequiredDocs } from "@/lib/required-documents";

type OnboardingInitial = {
  firstName: string; lastName: string; phone: string; birthDate: string; street: string; zip: string; city: string;
  employmentType: string; taxId: string; taxClass: string; childAllowances: number; socialSecurity: string;
  healthInsurance: string; iban: string; bic: string; entryDate: string;
};
type DocumentRow = { id: string; kind: string; status: string; fileUrl: string; createdAt: Date | string };
type FieldErrorKey = keyof OnboardingInitial | "privacy";

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Wird geprüft",
  verified: "Geprüft ✓",
  rejected: "Abgelehnt – bitte neu hochladen",
};

// Bildet die deutschen Server-Fehlermeldungen auf das zugehörige Formularfeld ab.
const ERROR_FIELD_PATTERNS: Array<[FieldErrorKey, string[]]> = [
  ["privacy", ["datenschutz"]],
  ["employmentType", ["beschäftigungsart"]],
  ["taxClass", ["steuerklasse"]],
  ["taxId", ["steuer-id", "steuerid"]],
  ["childAllowances", ["kinderfreibet"]],
  ["socialSecurity", ["sozialversicher"]],
  ["healthInsurance", ["krankenkasse"]],
  ["iban", ["iban"]],
  ["bic", ["bic"]],
  ["firstName", ["vorname"]],
  ["lastName", ["nachname"]],
  ["phone", ["telefon"]],
  ["birthDate", ["geburtsdatum"]],
  ["street", ["straße"]],
  ["zip", ["plz"]],
  ["city", ["ort"]],
  ["entryDate", ["eintrittsdatum"]],
];

function fieldErrorForMessage(raw: string): FieldErrorKey | null {
  const normalized = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [key, patterns] of ERROR_FIELD_PATTERNS) {
    if (patterns.some(pattern => normalized.includes(pattern))) return key;
  }
  return null;
}

const baseInputCls = "w-full bg-base-light border rounded-lg p-3 focus:outline-none transition-colors";

function OnboardingField({ label, error, children }: { label: React.ReactNode; error: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

// Stabil außerhalb der Komponente definiert – sonst baut React das Feld bei
// jedem Tastenschlag neu und der Fokus/die Eingabe geht verloren (1-Zeichen-Bug).
export function Field(props: { field: FieldErrorKey; label: React.ReactNode; error?: string; children: React.ReactNode }) {
  const { label, error, children } = props;
  return <OnboardingField label={label} error={error}>{children}</OnboardingField>;
}

// Datum: ISO YYYY-MM-DD <-> DE TT.MM.JJJJ (Tastatur-freundlich, kein Browser-Datum-Picker)
function isoToDe(iso: string) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
function deToIso(de: string) {
  const digits = de.replace(/\D/g, "");
  if (digits.length !== 8) return de; // teilgültig – Server prüft final
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}
function formatDeDateInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = digits;
  if (digits.length > 2) out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 4) out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  return out;
}

export default function OnboardingForm({ initial, roleName, documents: initialDocuments, requiredDocuments, hasContract, minijob }: { initial: OnboardingInitial; roleName: string; documents: DocumentRow[]; requiredDocuments: string[]; hasContract: boolean; minijob?: { name: string; bodyHtml: string } | null }) {
  const [form, setForm] = useState(initial);
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState("id_card");
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const checklist = resolveRequiredDocs(requiredDocuments, documents);
  const doneCount = checklist.filter(doc => doc.state === "done").length;

  const update = <K extends keyof OnboardingInitial>(key: K, value: OnboardingInitial[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const focusField = (key: FieldErrorKey) => {
    document.querySelector<HTMLElement>(`[data-field="${key}"]`)?.focus();
  };

  const fail = (raw: string) => {
    const key = fieldErrorForMessage(raw);
    if (key) {
      setFieldErrors({ [key]: raw });
      setMessage("");
      requestAnimationFrame(() => focusField(key));
    } else {
      setFieldErrors({});
      setMessage(raw);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!privacyAccepted) {
      setFieldErrors({ privacy: "Bitte bestätige die Datenschutzerklärung." });
      setMessage("");
      requestAnimationFrame(() => focusField("privacy"));
      return;
    }
    setBusy(true);
    setMessage("");
    setFieldErrors({});
    try {
      const result = await saveMyOnboarding({ ...form, privacyVersion: PRIVACY_VERSION });
      setMessage(result.documentWarning || (result.document ? "Daten gespeichert. Das Minijob-Formular wurde automatisch aus deinen Daten erstellt." : "Daten gespeichert."));
      if (result.document) {
        setDocuments(current => {
          const filtered = current.filter(document => document.kind !== "minijob_form");
          return [...filtered, { id: result.document!.id, kind: result.document!.kind, status: result.document!.status, fileUrl: result.document!.fileUrl, createdAt: result.document!.createdAt }];
        });
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (docKind: string, pickedFile: File | null) => {
    if (!pickedFile) return;
    setUploadingKind(docKind);
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", pickedFile);
      data.append("kind", docKind);
      const response = await fetch("/api/team/upload", { method: "POST", body: data });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setMessage(result?.error || "Upload fehlgeschlagen.");
        return;
      }
      setDocuments(current => [...current, result.document]);
      setMessage("Dokument hochgeladen.");
    } finally {
      setUploadingKind(null);
      const input = fileInputRef.current;
      if (input) input.value = "";
    }
  };

  const handleChecklistFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    void uploadDoc(pendingKind, event.target.files?.[0] || null);
  };

  const pickFile = (docKind: string) => {
    setPendingKind(docKind);
    setMessage("");
    fileInputRef.current?.click();
  };

  const fieldCls = (key: FieldErrorKey) =>
    `${baseInputCls} ${fieldErrors[key] ? "border-red-500 ring-2 ring-red-200 focus:border-red-500" : "border-border-light focus:border-accent-green"}`;

  const fieldErrorText = (key: FieldErrorKey) =>
    fieldErrors[key] ? <p className="mt-1 text-xs font-bold text-red-600">{fieldErrors[key]}</p> : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Onboarding</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Deine Daten</h1>
        <p className="text-base-dark/60 mt-1">Rolle: {roleName}. Pflichtfelder bitte vollständig ausfüllen.</p>
      </div>

      <form onSubmit={save} className="bg-white border border-border-light rounded-2xl p-5 space-y-6">
        <section>
          <h2 className="font-display font-bold text-xl mb-3">Persönliche Daten</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field field="firstName" label="Vorname *" error={fieldErrors.firstName}>
              <input required autoComplete="given-name" data-field="firstName" aria-invalid={!!fieldErrors.firstName} value={form.firstName} onChange={event => update("firstName", event.target.value)} className={fieldCls("firstName")} />
            </Field>
            <Field field="lastName" label="Nachname *" error={fieldErrors.lastName}>
              <input required autoComplete="family-name" data-field="lastName" aria-invalid={!!fieldErrors.lastName} value={form.lastName} onChange={event => update("lastName", event.target.value)} className={fieldCls("lastName")} />
            </Field>
            <Field field="phone" label="Telefon" error={fieldErrors.phone}>
              <input autoComplete="tel" inputMode="tel" data-field="phone" aria-invalid={!!fieldErrors.phone} value={form.phone} onChange={event => update("phone", event.target.value)} className={fieldCls("phone")} />
            </Field>
            <Field field="birthDate" label="Geburtsdatum (TT.MM.JJJJ)" error={fieldErrors.birthDate}>
              <input autoComplete="bday" inputMode="numeric" placeholder="z. B. 15.03.1995" data-field="birthDate" aria-invalid={!!fieldErrors.birthDate} value={isoToDe(form.birthDate)} onChange={event => update("birthDate", deToIso(formatDeDateInput(event.target.value)))} className={fieldCls("birthDate")} />
            </Field>
            <div className="sm:col-span-2">
              <Field field="street" label="Straße" error={fieldErrors.street}>
                <input autoComplete="address-line1" data-field="street" aria-invalid={!!fieldErrors.street} value={form.street} onChange={event => update("street", event.target.value)} className={fieldCls("street")} />
              </Field>
            </div>
            <Field field="zip" label="PLZ" error={fieldErrors.zip}>
              <input autoComplete="postal-code" inputMode="numeric" pattern="[0-9]*" maxLength={5} placeholder="z. B. 12345" data-field="zip" aria-invalid={!!fieldErrors.zip} value={form.zip} onChange={event => update("zip", event.target.value)} className={fieldCls("zip")} />
            </Field>
            <Field field="city" label="Ort" error={fieldErrors.city}>
              <input autoComplete="address-level2" data-field="city" aria-invalid={!!fieldErrors.city} value={form.city} onChange={event => update("city", event.target.value)} className={fieldCls("city")} />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl mb-3">Beschäftigung & Lohn</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field field="employmentType" label="Beschäftigungsart" error={fieldErrors.employmentType}>
              <select data-field="employmentType" aria-invalid={!!fieldErrors.employmentType} value={form.employmentType} onChange={event => update("employmentType", event.target.value)} className={fieldCls("employmentType")}>
                <option value="minijob">Minijob</option>
                <option value="short_term">Kurzfristig</option>
                <option value="student">Werkstudent</option>
                <option value="employed">Angestellt</option>
              </select>
            </Field>
            <Field field="entryDate" label="Eintrittsdatum (TT.MM.JJJJ)" error={fieldErrors.entryDate}>
              <input inputMode="numeric" placeholder="z. B. 01.12.2026" data-field="entryDate" aria-invalid={!!fieldErrors.entryDate} value={isoToDe(form.entryDate)} onChange={event => update("entryDate", deToIso(formatDeDateInput(event.target.value)))} className={fieldCls("entryDate")} />
            </Field>
            <Field field="taxId" label="Steuer-ID" error={fieldErrors.taxId}>
              <input autoComplete="off" inputMode="numeric" data-field="taxId" aria-invalid={!!fieldErrors.taxId} value={form.taxId} onChange={event => update("taxId", event.target.value)} className={fieldCls("taxId")} />
            </Field>
            <Field field="taxClass" label="Steuerklasse" error={fieldErrors.taxClass}>
              <input autoComplete="off" data-field="taxClass" aria-invalid={!!fieldErrors.taxClass} value={form.taxClass} onChange={event => update("taxClass", event.target.value)} className={fieldCls("taxClass")} />
            </Field>
            <Field field="childAllowances" label="Kinderfreibeträge" error={fieldErrors.childAllowances}>
              <input autoComplete="off" type="number" min={0} max={20} data-field="childAllowances" aria-invalid={!!fieldErrors.childAllowances} value={form.childAllowances} onChange={event => update("childAllowances", Number(event.target.value))} className={fieldCls("childAllowances")} />
            </Field>
            <Field field="socialSecurity" label="Sozialversicherungsnummer" error={fieldErrors.socialSecurity}>
              <input autoComplete="off" inputMode="numeric" data-field="socialSecurity" aria-invalid={!!fieldErrors.socialSecurity} value={form.socialSecurity} onChange={event => update("socialSecurity", event.target.value)} className={fieldCls("socialSecurity")} />
            </Field>
            <Field field="healthInsurance" label="Krankenkasse" error={fieldErrors.healthInsurance}>
              <input autoComplete="off" data-field="healthInsurance" aria-invalid={!!fieldErrors.healthInsurance} value={form.healthInsurance} onChange={event => update("healthInsurance", event.target.value)} className={fieldCls("healthInsurance")} />
            </Field>
            <Field field="iban" label="IBAN" error={fieldErrors.iban}>
              <input autoComplete="off" inputMode="text" placeholder="DE89 3704 0044 0532 0130 00" data-field="iban" aria-invalid={!!fieldErrors.iban} value={form.iban} onChange={event => update("iban", event.target.value)} className={fieldCls("iban")} />
            </Field>
            <Field field="bic" label="BIC" error={fieldErrors.bic}>
              <input autoComplete="off" data-field="bic" aria-invalid={!!fieldErrors.bic} value={form.bic} onChange={event => update("bic", event.target.value)} className={fieldCls("bic")} />
            </Field>
          </div>
          <p className="text-xs text-base-dark/50 mt-2">Steuer-ID, Sozialversicherungsnummer und IBAN werden verschlüsselt gespeichert.</p>
          <label className={`flex items-start gap-3 text-sm cursor-pointer mt-3 rounded-xl p-2 -m-2 ${fieldErrors.privacy ? "bg-red-50 ring-2 ring-red-200" : ""}`}>
            <input type="checkbox" required data-field="privacy" aria-invalid={!!fieldErrors.privacy} checked={privacyAccepted} onChange={event => { setPrivacyAccepted(event.target.checked); setFieldErrors(current => { const next = { ...current }; delete next.privacy; return next; }); }} className={`mt-1 w-5 h-5 accent-accent-green ${fieldErrors.privacy ? "ring-2 ring-red-400 rounded" : ""}`} />
            <span className="text-base-dark/80">Ich habe die <Link href="/datenschutz" target="_blank" className="text-accent-green underline underline-offset-4 font-bold">Datenschutzerklärung</Link> gelesen und stimme der Verarbeitung meiner Daten im Rahmen des Beschäftigungsverhältnisses (§ 26 Abs. 1 BDSG) zu. Version {PRIVACY_VERSION}. *</span>
          </label>
          {fieldErrorText("privacy")}
        </section>

        <button type="submit" disabled={busy || !privacyAccepted} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Daten speichern"}</button>
        {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}
      </form>

      <form onSubmit={event => event.preventDefault()} className="bg-white border border-border-light rounded-2xl p-5 space-y-4">
        <h2 className="font-display font-bold text-xl">Dokumente</h2>
        <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleChecklistFile} />

        {checklist.length > 0 && (
          <section className="rounded-xl border border-border-light bg-canvas-light p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-bold">Zwingend benötigte Dokumente</p>
              <span className="text-xs font-bold text-base-dark/60">{doneCount} von {checklist.length} hochgeladen</span>
            </div>
            <div className="w-full bg-border-light rounded-full h-2.5 overflow-hidden mb-3" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={checklist.length} aria-label="Dokumente hochgeladen">
              <div className="bg-accent-green h-2.5 rounded-full transition-all duration-500" style={{ width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%` }} />
            </div>
            <ul className="space-y-2">
              {checklist.map(doc => {
                const info = docInfoFor(doc.label, doc.kind);
                const infoKey = `${doc.kind}-${doc.label}`;
                const uploading = uploadingKind === doc.kind;
                return (
                  <li
                    key={infoKey}
                    className={`rounded-xl border px-3 py-3 ${doc.state === "done" ? "border-accent-green/40 bg-white" : "border-amber-300 bg-amber-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${doc.state === "done" ? "bg-accent-green text-white" : "bg-amber-400 text-white"}`}
                      >
                        {doc.state === "done" ? "✓" : "!"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{doc.label}</p>
                        <p className="text-xs text-base-dark/60">
                          {doc.state === "done"
                            ? "Hochgeladen ✓"
                            : doc.state === "rejected"
                              ? "Abgelehnt – bitte erneut hochladen"
                              : "Fehlt noch – bitte unbedingt hochladen"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Herkommen anzeigen"
                        aria-pressed={infoOpen === infoKey}
                        onClick={() => setInfoOpen(open => open === infoKey ? null : infoKey)}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-base-dark/20 text-xs font-black text-base-dark/60 hover:border-accent-green hover:text-accent-green"
                      >
                        i
                      </button>
                      {doc.state !== "done" && (
                        <button
                          type="button"
                          onClick={() => pickFile(doc.kind)}
                          disabled={uploading}
                          className="min-h-10 shrink-0 rounded-lg bg-base-dark px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
                        >
                          {uploading ? "⏳ Wird hochgeladen …" : "Datei auswählen"}
                        </button>
                      )}
                    </div>
                    {infoOpen === infoKey && (
                      <div className="mt-3 ml-10 rounded-lg bg-white border border-border-light p-3 text-xs leading-relaxed">
                        <p className="font-bold text-sm mb-1">Wo bekomme ich das? {info.title}</p>
                        <p className="text-base-dark/70">{info.text}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {doneCount === checklist.length && (
              <p className="mt-3 text-xs font-bold text-accent-green">✓ Alle Pflichtdokumente sind hochgeladen.</p>
            )}
          </section>
        )}

        {checklist.length === 0 && (
          <section className="rounded-xl border border-border-light bg-canvas-light p-4">
            <p className="text-sm font-bold mb-3">Optionales Dokument</p>
            <div className="flex items-center gap-3 bg-white border border-border-light rounded-xl px-3 py-3">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black bg-base-dark/10 text-base-dark/60">+</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Weitere Dokumente</p>
                <p className="text-xs text-base-dark/60">Optional – z. B. ein Attest oder eine Zusatzbescheinigung.</p>
              </div>
              <button
                type="button"
                onClick={() => pickFile("other")}
                disabled={uploadingKind === "other"}
                className="min-h-10 shrink-0 rounded-lg bg-base-dark px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
              >
                {uploadingKind === "other" ? "⏳ Wird hochgeladen …" : "Datei auswählen"}
              </button>
            </div>
          </section>
        )}
        <div className="space-y-2">
          {documents.map(document => (
            <div key={document.id} className="flex items-center justify-between gap-3 bg-base-light border border-border-light rounded-xl p-3 text-sm">
              <span className="font-bold">{DOCUMENT_KIND_LABELS[document.kind] || document.kind}</span>
              <span className="text-base-dark/60">{DOCUMENT_STATUS_LABELS[document.status] || document.status}</span>
              <div className="flex gap-3">
                <a href={`/api/team/file?documentId=${document.id}`} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-green underline">Öffnen</a>
                {document.kind !== "minijob_form" && (
                  <button type="button" onClick={async () => { if (!confirm("Dokument wirklich löschen?")) return; try { await deleteMyDocument(document.id); setDocuments(current => current.filter(d => d.id !== document.id)); setMessage("Dokument gelöscht."); } catch (e) { setMessage(e instanceof Error ? e.message : "Löschen fehlgeschlagen."); } }} className="font-bold text-red-600">Löschen</button>
                )}
              </div>
            </div>
          ))}
          {documents.length === 0 && <p className="text-sm text-base-dark/50">Noch keine Dokumente hochgeladen.</p>}
        </div>
      </form>

      <div className="bg-canvas-light border border-border-light rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-bold">Vertrag</p><p className="text-sm text-base-dark/60">{hasContract ? "Dein Vertrag liegt zur Unterschrift bereit." : "Der Vertrag wird nach dem Speichern deiner Daten erzeugt."}</p></div>
        <Link href="/team/vertrag" className="bg-accent-green text-white px-5 py-3 rounded-xl font-bold">Zum Vertrag</Link>
      </div>

      {minijob && (
        <div className="bg-white border border-border-light rounded-2xl p-5">
          <p className="font-bold">{minijob.name}</p>
          <p className="text-sm text-base-dark/60 mb-3">Wird automatisch aus deinen Daten erstellt – hier eine Vorschau:</p>
          <div className="rounded-xl bg-slate-50 border border-border-light p-4 text-sm leading-relaxed max-h-72 overflow-auto [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_p]:my-2" dangerouslySetInnerHTML={{ __html: minijob.bodyHtml }} />
        </div>
      )}
    </div>
  );
}
