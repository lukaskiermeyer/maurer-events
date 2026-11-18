"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import { Link } from "@/i18n/routing";
import { Pencil, Eye, Mail, Power, PowerOff, Trash2 } from "lucide-react";import type { ContractTemplate, StaffRecord, StaffRole } from "@/types/domain";
import type { documentFormTemplates } from "@/db/schema";
import { createRole, createStaff, deleteContractTemplate, deleteRoleHardDev, deleteStaffHardDev, resendStaffInvite, saveContractTemplate, updateRole, updateStaffAdmin } from "@/app/actions/staff";
import { deleteDocumentTemplate, saveDocumentTemplate } from "@/app/actions/document-templates";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div className="h-40 bg-canvas-light animate-pulse rounded-lg flex items-center justify-center opacity-50 text-sm">Lade Editor …</div>,
});

type StaffRow = { member: StaffRecord; role: StaffRole | null };
type TemplateRow = { template: ContractTemplate; role: StaffRole | null };
type DocumentTemplate = typeof documentFormTemplates.$inferSelect;
type TabKey = "team" | "roles" | "contracts" | "minijob";

const SAMPLE_MINIJOB = `<h1>Minijob-Formular</h1>
<p>Arbeitnehmer: {{name}}<br/>Geburtsdatum: {{geburtsdatum}}<br/>Adresse: {{adresse}}<br/>Telefon: {{telefon}}<br/>E-Mail: {{email}}</p>
<h2>Angaben zum Beschäftigungsverhältnis</h2>
<p>Rolle: {{rolle}}<br/>Eintritt: {{eintritt}}<br/>Stundensatz: {{stundensatz}} €<br/>Steuer-ID: {{steuerId}}<br/>Steuerklasse: {{steuerklasse}}<br/>Kinderfreibeträge: {{kinderfreibetraege}}<br/>Sozialversicherungsnummer: {{sozialversicherungsnummer}}<br/>Krankenkasse: {{krankenkasse}}<br/>IBAN: {{iban}} · BIC: {{bic}}</p>
<p>Bestätigt am {{heute}}</p>
<p>Unterschrift Arbeitnehmer: ____________________</p>`;

const SAMPLE_CONTRACT = `<h2>Arbeitsvertrag</h2>
<p>Zwischen Maurer Events und {{name}}, {{adresse}}, wird folgender Vertrag geschlossen.</p>
<p>Rolle: {{rolle}}<br/>{{#if stundensatz}}Stundensatz: {{stundensatz}} €<br/>{{/if}}{{#if gewinnbeteiligung}}Umsatzbeteiligung: {{gewinnbeteiligung}} %<br/>{{/if}}Eintritt: {{eintritt}}</p>
<h3>§ 1 Tätigkeit</h3>
<p>Die beschriebene Tätigkeit wird nach Weisung des Festwirts ausgeübt.</p>
<h3>§ 2 Vergütung</h3>
{{#if stundensatz}}<p>Die Vergütung erfolgt auf Basis der geleisteten Stunden ({{stundensatz}} €/Std.).</p>{{/if}}
{{#if gewinnbeteiligung}}<p>Zusätzlich erhält die Person eine Umsatzbeteiligung in Höhe von {{gewinnbeteiligung}} %.</p>{{/if}}
<h3>§ 3 Datenschutz</h3>
<p>Die Verarbeitung der personenbezogenen Daten erfolgt zum Zweck der Beschäftigung.</p>
<p>Ort, Datum: {{ort}}, {{heute}}</p>
<p>Unterschrift Arbeitgeber: ____________________</p>
<p>Unterschrift Arbeitnehmer: ____________________</p>`;

const DOC_OPTIONS = ["Ausweis", "Gesundheitszeugnis", "Steuerkarte", "Minijob-Formular", "Führerschein", "Arbeitszeugnis"];

const CONTRACT_PLACEHOLDERS = [
  { token: "{{name}}", label: "Name der Person", example: "Max Mustermann" },
  { token: "{{rolle}}", label: "Rolle / Job", example: "Servierkraft" },
  { token: "{{stundensatz}}", label: "Stundensatz", example: "15,00" },
  { token: "{{gewinnbeteiligung}}", label: "Umsatzbeteiligung (%)", example: "5" },
  { token: "{{eintritt}}", label: "Eintrittsdatum", example: "01.12.2026" },
  { token: "{{adresse}}", label: "Adresse", example: "Musterstraße 1, 12345 Musterstadt" },
  { token: "{{heute}}", label: "Heutiges Datum", example: "07.11.2026" },
  { token: "{{ort}}", label: "Ort (manuell ausfüllen)", example: "München" },
] as const;


function buildPreviewHtml(html: string, overrides: Record<string, string> = {}) {
  // Values used to evaluate conditional blocks ({{#if key}}...{{/if}}).
  const values: Record<string, string> = {};
  for (const item of CONTRACT_PLACEHOLDERS) {
    values[item.token] = (item.token in overrides) ? overrides[item.token] : item.example;
  }
  // Also accept bare keys.
  for (const k of Object.keys(overrides)) {
    const bare = k.replace(/^\{\{|\}\}$/g, "").trim();
    if (bare && !(bare in values) && !(k in values)) values[k] = overrides[k];
    if (bare && !(("{{" + bare + "}}") in values)) values["{{" + bare + "}}"] = overrides[k];
  }
  const isTruthy = (v: string | undefined) => {
    if (v === undefined || v === null || v === "") return false;
    const n = String(v).replace(",", ".");
    if (n === "0" || n === "0.0" || n === "0.00") return false;
    return true;
  };
  let result = html.replace(/\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/gi, (_, key, content) => {
    const v = values[`{{${key}}}`] ?? values[key];
    return isTruthy(v) ? content : "";
  });
  result = result.replace(/\{\{#unless\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/unless\}\}/gi, (_, key, content) => {
    const v = values[`{{${key}}}`] ?? values[key];
    return isTruthy(v) ? "" : content;
  });
  return CONTRACT_PLACEHOLDERS.reduce((acc, item) => {
    const val = (item.token in overrides) ? overrides[item.token] : item.example;
    return acc.split(item.token).join(`<mark style="background:#dcfce7;border-radius:4px;padding:0 4px;font-weight:700">${val}</mark>`);
  }, result);
}

const MINIJOB_PLACEHOLDERS = [
  { token: "{{name}}", label: "Name der Person", example: "Max Mustermann" },
  { token: "{{geburtsdatum}}", label: "Geburtsdatum", example: "15.03.1995" },
  { token: "{{adresse}}", label: "Adresse", example: "Musterstraße 1, 12345 Musterstadt" },
  { token: "{{telefon}}", label: "Telefon", example: "0151 12345678" },
  { token: "{{email}}", label: "E-Mail", example: "max.mustermann@example.com" },
  { token: "{{rolle}}", label: "Rolle / Job", example: "Servierkraft" },
  { token: "{{eintritt}}", label: "Eintrittsdatum", example: "01.12.2026" },
  { token: "{{stundensatz}}", label: "Stundensatz", example: "15,00" },
  { token: "{{steuerId}}", label: "Steuer-ID", example: "12 345 678 901" },
  { token: "{{steuerklasse}}", label: "Steuerklasse", example: "1" },
  { token: "{{kinderfreibetraege}}", label: "Kinderfreibeträge", example: "0" },
  { token: "{{sozialversicherungsnummer}}", label: "Sozialversicherungsnummer", example: "12-34567890-123" },
  { token: "{{krankenkasse}}", label: "Krankenkasse", example: "Beispiel Krankenkasse" },
  { token: "{{iban}}", label: "IBAN", example: "DE89 3704 0044 0532 0130 00" },
  { token: "{{bic}}", label: "BIC", example: "COBADEFFXXX" },
  { token: "{{heute}}", label: "Heutiges Datum", example: "07.11.2026" },
] as const;

function buildMinijobPreviewHtml(html: string, overrides: Record<string, string> = {}) {
  return MINIJOB_PLACEHOLDERS.reduce((acc, item) => acc.split(item.token).join(`<mark style="background:#dcfce7;border-radius:4px;padding:0 4px;font-weight:700">${overrides[item.token] || item.example}</mark>`), html);
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  invited: { label: "Eingeladen", cls: "bg-slate-100 text-slate-700" },
  onboarding: { label: "Profil offen", cls: "bg-amber-100 text-amber-800" },
  ready: { label: "Bereit", cls: "bg-sky-100 text-sky-800" },
  active: { label: "Aktiv", cls: "bg-accent-green/15 text-accent-green" },
  inactive: { label: "Inaktiv", cls: "bg-red-100 text-red-700" },
};

const TEMPLATE_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Entwurf", cls: "bg-slate-100 text-slate-700" },
  reviewed: { label: "Geprüft", cls: "bg-sky-100 text-sky-800" },
  active: { label: "Aktiv", cls: "bg-accent-green/15 text-accent-green" },
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function euroToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

const inputCls = "w-full bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green transition-colors";
// Mobile-Aktionsbutton: 44px Touch-Target, 2 pro Zeile (ungerader letzter Button füllt die Zeile).
const mBtn = "flex-1 basis-[calc(50%-0.25rem)] min-h-11 px-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors";

function Help({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded-xl bg-canvas-light border border-border-light group">
      <summary className="p-3 text-sm font-bold cursor-pointer select-none hover:text-accent-green list-none flex items-center gap-2">
        <span aria-hidden>💡</span> So funktioniert&apos;s
        <span aria-hidden className="ml-auto transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-3 pb-3 text-xs leading-relaxed text-base-dark/70 space-y-2 [&_ul]:list-disc [&_ul]:pl-4">
        {children}
      </div>
    </details>
  );
}

export default function StaffAdmin({ initialStaff, initialRoles, initialTemplates, initialDocumentTemplates }: { initialStaff: StaffRow[]; initialRoles: StaffRole[]; initialTemplates: TemplateRow[]; initialDocumentTemplates: DocumentTemplate[] }) {
  const [tab, setTab] = useState<TabKey>("team");
  const [staffForm, setStaffForm] = useState({ id: "", email: "", firstName: "", lastName: "", phone: "", roleId: initialRoles[0]?.id || "", status: "invited", hourlyRateEuro: "", profitSharePercent: "" });
  const [keyTouched, setKeyTouched] = useState(false);
  const [roleForm, setRoleForm] = useState({ key: "", name: "", hourlyRateEuro: "", profitSharePercent: "", requiredDocuments: [] as string[], requiresHandwrittenSignature: false });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [templateForm, setTemplateForm] = useState({ roleId: initialRoles[0]?.id || "", name: "Arbeitsvertrag", bodyHtml: SAMPLE_CONTRACT, signatureMode: "text" as "text" | "handwritten", status: "active" as "draft" | "reviewed" | "active" });
  const [contractStep, setContractStep] = useState(1);
  const [contractViewMode, setContractViewMode] = useState<"editor" | "live">("editor");
  const [previewExample, setPreviewExample] = useState({ name: "Max Mustermann", rate: "15,00" });
  const [minijobStep, setMinijobStep] = useState(1);
  const [minijobViewMode, setMinijobViewMode] = useState<"editor" | "live">("editor");
  const minijobTemplate = initialDocumentTemplates.find(template => template.kind === "minijob") || null;
  const [minijobForm, setMinijobForm] = useState({ id: minijobTemplate?.id || "", name: minijobTemplate?.name || "Minijob-Formular", bodyHtml: minijobTemplate?.bodyHtml || SAMPLE_MINIJOB, status: (minijobTemplate?.status as "draft" | "active") || "draft" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const gotoTab = (key: TabKey) => { setTab(key); setMessage(""); };

  const hasActiveTemplate = (roleId: string) =>
    initialTemplates.some(({ template }) => template.roleId === roleId && template.status === "active");

  const goCreateTemplateForRole = () => {
    setTemplateForm(prev => ({ ...prev, roleId: staffForm.roleId }));
    gotoTab("contracts");
  };

  const insertPlaceholder = (token: string) => {
    setTemplateForm(prev => {
      const separator = prev.bodyHtml.endsWith(" ") ? "" : " ";
      return { ...prev, bodyHtml: `${prev.bodyHtml}${separator}${token} ` };
    });
    setMessage(`„${CONTRACT_PLACEHOLDERS.find(p => p.token === token)?.label}“ wurde am Ende des Textes eingefügt. Du kannst den Text danach verschieben.`);
  };

  const loadExistingTemplate = (templateId: string) => {
    const found = initialTemplates.find(({ template }) => template.id === templateId);
    if (!found) return;
    setTemplateForm(prev => ({ ...prev, name: `${found.template.name} (Kopie)`, bodyHtml: found.template.bodyHtml, signatureMode: found.template.signatureMode as "text" | "handwritten", roleId: found.template.roleId || prev.roleId }));
    setContractStep(2);
  };

  const insertMinijobPlaceholder = (token: string) => {
    setMinijobForm(prev => {
      const separator = prev.bodyHtml.endsWith(" ") ? "" : " ";
      return { ...prev, bodyHtml: `${prev.bodyHtml}${separator}${token} ` };
    });
    setMessage(`„${MINIJOB_PLACEHOLDERS.find(p => p.token === token)?.label}“ wurde am Ende des Textes eingefügt.`);
  };

  const minijobPreviewHtml = buildMinijobPreviewHtml(minijobForm.bodyHtml, { "{{name}}": previewExample.name || "Max Mustermann", "{{stundensatz}}": previewExample.rate || "15,00" });

  const selectedRoleName = initialRoles.find(role => role.id === templateForm.roleId)?.name || "Mitarbeiter";
  const selectedRoleForPreview = initialRoles.find(role => role.id === templateForm.roleId);
  const hasSelectedRole = !!selectedRoleForPreview;
  const previewStundensatz = hasSelectedRole
    ? ((selectedRoleForPreview!.hourlyRateCents || 0) > 0 ? (selectedRoleForPreview!.hourlyRateCents / 100).toFixed(2).replace(".", ",") : "")
    : (previewExample.rate || "15,00");
  const previewGewinnbeteiligung = hasSelectedRole
    ? (selectedRoleForPreview!.profitSharePercent != null ? String(selectedRoleForPreview!.profitSharePercent).replace(".", ",") : "0")
    : "5";
  const previewHtml = buildPreviewHtml(templateForm.bodyHtml, { "{{name}}": previewExample.name || "Max Mustermann", "{{rolle}}": selectedRoleName, "{{stundensatz}}": previewStundensatz, "{{gewinnbeteiligung}}": previewGewinnbeteiligung });

  const toggleDoc = (doc: string) => {
    setRoleForm(prev => ({
      ...prev,
      requiredDocuments: prev.requiredDocuments.includes(doc)
        ? prev.requiredDocuments.filter(d => d !== doc)
        : [...prev.requiredDocuments, doc],
    }));
  };

  const createTeamMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(""); setInviteUrl("");
    try {
      const result = await createStaff(staffForm);
      setInviteUrl(result.inviteUrl);
      setMessage(result.warning || "Mitarbeiter angelegt. Die Person erhält eine Einladungsmail mit einem persönlichen Link (7 Tage gültig).");
      setStaffForm({ id: "", email: "", firstName: "", lastName: "", phone: "", roleId: initialRoles[0]?.id || "", status: "invited", hourlyRateEuro: "", profitSharePercent: "" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mitarbeiter konnte nicht angelegt werden.");
    } finally { setBusy(false); }
  };

  const createNewRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const payload = {
        name: roleForm.name,
        hourlyRateCents: euroToCents(roleForm.hourlyRateEuro),
        profitSharePercent: roleForm.profitSharePercent.trim() === "" ? null : Number(roleForm.profitSharePercent.trim().replace(",", ".")),
        requiredDocuments: roleForm.requiredDocuments,
        requiresHandwrittenSignature: roleForm.requiresHandwrittenSignature,
      };
      if (editingRoleId) {
        await updateRole(editingRoleId, payload);
        setEditingRoleId(null);
        setRoleForm({ key: "", name: "", hourlyRateEuro: "", profitSharePercent: "", requiredDocuments: [], requiresHandwrittenSignature: false });
        setMessage("Rolle gespeichert.");
        window.location.reload();
      } else {
        await createRole({
          key: roleForm.key || slugify(roleForm.name),
          ...payload,
        });
        window.location.reload();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rolle konnte nicht gespeichert werden.");
    } finally { setBusy(false); }
  };

  const startEditRole = (role: StaffRole) => {
    setEditingRoleId(role.id);
    setKeyTouched(true);
    setRoleForm({ key: role.key, name: role.name, hourlyRateEuro: (role.hourlyRateCents / 100).toFixed(2), profitSharePercent: role.profitSharePercent != null ? String(role.profitSharePercent).replace(".", ",") : "", requiredDocuments: role.requiredDocuments || [], requiresHandwrittenSignature: role.requiresHandwrittenSignature });
    setMessage("");
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setKeyTouched(false);
    setRoleForm({ key: "", name: "", hourlyRateEuro: "", profitSharePercent: "", requiredDocuments: [], requiresHandwrittenSignature: false });
  };

  const toggleRoleActive = async (role: StaffRole) => {
    const nextActive = !role.active;
    if (!nextActive && !confirm(`Rolle „${role.name}" wirklich deaktivieren? Sie kann danach nicht für neue Mitarbeiter gewählt werden, bleibt aber in der Liste.`)) return;
    setBusy(true); setMessage("");
    try {
      const result = await updateRole(role.id, { active: nextActive });
      if (result.warning) setMessage(result.warning);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ändern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const saveStaffEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffForm.id) return;
    setBusy(true); setMessage("");
    try {
      const selectedRole = initialRoles.find(r => r.id === staffForm.roleId);
      await updateStaffAdmin(staffForm.id, {
        firstName: staffForm.firstName,
        lastName: staffForm.lastName,
        phone: staffForm.phone || null,
        roleId: staffForm.roleId || undefined,
        status: staffForm.status,
        hourlyRateCents: selectedRole ? selectedRole.hourlyRateCents : 0,
        profitSharePercent: selectedRole ? selectedRole.profitSharePercent : null,
      });
      setIsEditingStaff(false);
      setStaffForm({ id: "", email: "", firstName: "", lastName: "", phone: "", roleId: initialRoles[0]?.id || "", status: "invited", hourlyRateEuro: "", profitSharePercent: "" });
      setMessage("Mitarbeiter gespeichert.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const toggleStaffInactive = async (memberId: string, name: string, currentStatus: string) => {
    const next = currentStatus === "inactive" ? "active" : "inactive";
    const label = next === "inactive"
      ? `${name} wirklich inaktiv setzen? Die Person wird sofort abgemeldet und kann sich nicht mehr anmelden. Daten bleiben erhalten.`
      : `${name} wirklich wieder aktivieren?`;
    if (!confirm(label)) return;
    setBusy(true); setMessage("");
    try {
      await updateStaffAdmin(memberId, { status: next });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ändern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const resendInvite = async (staffId: string) => {
    setBusy(true); setMessage(""); setInviteUrl("");
    try {
      const result = await resendStaffInvite(staffId);
      setInviteUrl(result.inviteUrl);
      setMessage(result.warning || "Einladung erneut gesendet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Einladung konnte nicht gesendet werden.");
    } finally { setBusy(false); }
  };

  const isDev = process.env.NODE_ENV === "development";

  const devDeleteStaff = async (staffId: string, name: string) => {
    if (!confirm(`DEV ONLY: ${name} ENDGÜLTIG löschen (Testmüll)? Verträge, Dokumente & Co. verschwinden sofort – ohne Aufbewahrungs-Check. Nur für Tests!`)) return;
    setBusy(true); setMessage("");
    try {
      await deleteStaffHardDev(staffId);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const devDeleteRole = async (roleId: string, name: string) => {
    if (!confirm(`DEV ONLY: Rolle „${name}" ENDGÜLTIG löschen (Testmüll)? Mitarbeiter mit dieser Rolle verlieren die Zuordnung (wird leer). Nur für Tests!`)) return;
    setBusy(true); setMessage("");
    try {
      await deleteRoleHardDev(roleId);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await saveContractTemplate(templateForm);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vertragsvorlage konnte nicht angelegt werden.");
    } finally { setBusy(false); }
  };

  const deleteTemplate = async (templateId: string, name: string, status: string) => {
    const label = status === "active"
      ? `Aktive Vorlage „${name}“ löschen? Neue Mitarbeiter mit dieser Rolle erhalten dann keinen Vertrag mehr, bis du wieder eine aktive Vorlage anlegst. Bereits erstellte Verträge bleiben erhalten. Das kann nicht rückgängig gemacht werden.`
      : `Vorlage „${name}“ löschen? Bereits erstellte Verträge bleiben erhalten. Das kann nicht rückgängig gemacht werden.`;
    if (!confirm(label)) return;
    setBusy(true); setMessage("");
    try {
      await deleteContractTemplate(templateId);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vorlage konnte nicht gelöscht werden.");
    } finally { setBusy(false); }
  };

  const saveMinijob = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await saveDocumentTemplate({ id: minijobForm.id || undefined, name: minijobForm.name, kind: "minijob", bodyHtml: minijobForm.bodyHtml, status: minijobForm.status });
      setMessage("Minijob-Formular gespeichert. Ab jetzt wird es automatisch aus den Onboarding-Daten erstellt.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Minijob-Formular konnte nicht gespeichert werden.");
    } finally { setBusy(false); }
  };

  const removeMinijob = async () => {
    if (!minijobForm.id || !confirm("Minijob-Formular wirklich löschen?")) return;
    setBusy(true); setMessage("");
    try {
      await deleteDocumentTemplate(minijobForm.id);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Mitarbeiter</h1>
          <p className="text-base-dark/60 mt-1">Team, Rollen und Verträge verwalten.</p>
        </div>
        <Link href="/admin/mitarbeiter/export" className="min-h-12 inline-flex items-center px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors">DATEV-Export</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 bg-white p-1 rounded-xl border border-border-light w-full sm:w-fit shadow-sm" role="tablist">
        {([["team", "Team"], ["roles", "Rollen"], ["contracts", "Verträge"], ["minijob", "Minijob-Formular"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => gotoTab(key)}
            className={`min-h-12 px-4 sm:px-5 rounded-lg font-bold text-sm transition-all duration-200 ${tab === key ? "bg-accent-green text-white shadow-md shadow-accent-green/25" : "text-base-dark/50 hover:text-base-dark hover:bg-base-light"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green border border-accent-green/30 rounded-xl p-3">{message}</p>}
      {isDev && <p className="text-xs font-bold bg-purple-50 border border-purple-200 text-purple-800 rounded-xl p-3">🗑 Dev-Modus: &ldquo;Dev löschen&rdquo; löscht endgültig (ohne Aufbewahrungs-Check, ohne Anonymisierung). In Produktion ausgeblendet und blockiert.</p>}
      {inviteUrl && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm break-all"><p className="font-bold mb-1">Einladungslink (falls die Mail nicht ankam):</p><a href={inviteUrl} className="text-accent-green underline">{inviteUrl}</a></div>}

      {tab === "team" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
            <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Team ({initialStaff.length})</h2>
            {initialStaff.length === 0 ? (
              <p className="p-6 text-base-dark/60">Noch keine Mitarbeiter. Lade hier neben dem Formular das erste Teammitglied ein.</p>
            ) : (
              <>
              <div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
                <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aktionen</th></tr></thead>
                <tbody>{initialStaff.map(({ member, role }) => {
                  const status = STATUS_META[member.status] || STATUS_META.invited;
                  return (
                    <tr key={member.id} className="border-t border-border-light">
                      <td className="px-4 py-3 font-bold">{member.firstName} {member.lastName}<div className="text-xs font-normal text-base-dark/50">{member.email}</div></td>
                      <td className="px-4 py-3">{role?.name || "—"}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button type="button" disabled={busy} onClick={() => {
                             setStaffForm({ id: member.id, email: member.email, firstName: member.firstName, lastName: member.lastName, phone: member.phone || "", roleId: member.roleId || "", status: member.status, hourlyRateEuro: (member.hourlyRateCents / 100).toFixed(2), profitSharePercent: member.profitSharePercent != null ? String(member.profitSharePercent).replace(".", ",") : "" });
                             setIsEditingStaff(true);
                             setMessage("");
                           }} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-border-light bg-white text-xs font-bold text-accent-green hover:border-accent-green hover:bg-accent-green/5 disabled:opacity-50 transition-colors" title="Bearbeiten">
                             <Pencil size={13} /> Bearbeiten
                           </button>
                          <Link href={`/admin/mitarbeiter/${member.id}`} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-border-light bg-white text-xs font-bold text-accent-green hover:border-accent-green hover:bg-accent-green/5 transition-colors" title="Öffnen">
                             <Eye size={13} /> Öffnen
                           </Link>
                          {(member.status === "invited" || member.status === "onboarding") && (
                             <button type="button" disabled={busy} onClick={() => resendInvite(member.id)} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-border-light bg-white text-xs font-bold text-accent-green hover:border-accent-green hover:bg-accent-green/5 disabled:opacity-50 transition-colors" title="Einladung erneut senden">
                               <Mail size={13} /> Einladung
                             </button>
                           )}
                          <button type="button" disabled={busy} onClick={() => toggleStaffInactive(member.id, `${member.firstName} ${member.lastName}`, member.status)} className={`inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50 transition-colors ${member.status === "inactive" ? "border-accent-green/40 bg-accent-green/5 text-accent-green hover:bg-accent-green/10" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`} title={member.status === "inactive" ? "Aktivieren" : "Inaktiv setzen"}>
                             {member.status === "inactive" ? <Power size={13} /> : <PowerOff size={13} />} {member.status === "inactive" ? "Aktivieren" : "Inaktiv setzen"}
                           </button>
                          {isDev && (
                             <button type="button" disabled={busy} onClick={() => devDeleteStaff(member.id, `${member.firstName} ${member.lastName}`)} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors" title="Nur Dev – endgültig löschen">
                               <Trash2 size={13} /> Dev löschen
                             </button>
                           )}
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>

              <div className="md:hidden divide-y divide-border-light">
                {initialStaff.map(({ member, role }) => {
                  const status = STATUS_META[member.status] || STATUS_META.invited;
                  return (
                    <div key={member.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold leading-tight">{member.firstName} {member.lastName}</p>
                          <p className="text-xs text-base-dark/50 truncate">{member.email}</p>
                          <p className="text-xs text-base-dark/60 mt-0.5">{role?.name || "—"}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={busy} onClick={() => {
                          setStaffForm({ id: member.id, email: member.email, firstName: member.firstName, lastName: member.lastName, phone: member.phone || "", roleId: member.roleId || "", status: member.status, hourlyRateEuro: (member.hourlyRateCents / 100).toFixed(2), profitSharePercent: member.profitSharePercent != null ? String(member.profitSharePercent).replace(".", ",") : "" });
                          setIsEditingStaff(true);
                          setMessage("");
                        }} className={`${mBtn} border-border-light bg-white text-accent-green hover:border-accent-green hover:bg-accent-green/5`}><Pencil size={14} /> Bearbeiten</button>
                        <Link href={`/admin/mitarbeiter/${member.id}`} className={`${mBtn} border-border-light bg-white text-accent-green hover:border-accent-green hover:bg-accent-green/5`}><Eye size={14} /> Öffnen</Link>
                        {(member.status === "invited" || member.status === "onboarding") && (
                          <button type="button" disabled={busy} onClick={() => resendInvite(member.id)} className={`${mBtn} border-border-light bg-white text-accent-green hover:border-accent-green hover:bg-accent-green/5 disabled:opacity-50`}><Mail size={14} /> Einladung</button>
                        )}
                        <button type="button" disabled={busy} onClick={() => toggleStaffInactive(member.id, `${member.firstName} ${member.lastName}`, member.status)} className={`${mBtn} disabled:opacity-50 ${member.status === "inactive" ? "border-accent-green/40 bg-accent-green/5 text-accent-green hover:bg-accent-green/10" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`}>
                          {member.status === "inactive" ? <Power size={14} /> : <PowerOff size={14} />} {member.status === "inactive" ? "Aktivieren" : "Inaktiv"}
                        </button>
                        {isDev && (
                          <button type="button" disabled={busy} onClick={() => devDeleteStaff(member.id, `${member.firstName} ${member.lastName}`)} className={`${mBtn} border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100`}><Trash2 size={14} /> Dev löschen</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>

          <form onSubmit={isEditingStaff ? saveStaffEdit : createTeamMember} className="bg-white border border-border-light rounded-2xl p-5 space-y-4 h-fit shadow-sm">
            <h2 className="font-display font-bold text-xl">{isEditingStaff ? "Mitarbeiter bearbeiten" : "Mitarbeiter einladen"}</h2>
            <Help>
              <p>Die Person bekommt eine E-Mail mit einem persönlichen Einladungslink (7 Tage gültig) und füllt anschließend selbstständig ihr Profil aus (Daten, Dokumente, Vertrag). Du musst danach nichts weiter tun.</p>
              <ul>
                <li><strong>E-Mail:</strong> An diese Adresse geht der Einladungslink.</li>
                <li><strong>Rolle:</strong> Die Rolle bestimmt den Stundensatz – er wird automatisch übernommen.</li>
              </ul>
            </Help>
            <input required type="email" placeholder="E-Mail der Person" value={staffForm.email} onChange={event => setStaffForm({ ...staffForm, email: event.target.value })} className={inputCls} disabled={isEditingStaff} />
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Vorname" value={staffForm.firstName} onChange={event => setStaffForm({ ...staffForm, firstName: event.target.value })} className={inputCls} />
              <input required placeholder="Nachname" value={staffForm.lastName} onChange={event => setStaffForm({ ...staffForm, lastName: event.target.value })} className={inputCls} />
            </div>
            <select required value={staffForm.roleId} onChange={event => setStaffForm({ ...staffForm, roleId: event.target.value })} className={inputCls}>
              <option value="">Rolle wählen …</option>
              {initialRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            {isEditingStaff && (
              <>
                <input placeholder="Telefon" value={staffForm.phone} onChange={event => setStaffForm({ ...staffForm, phone: event.target.value })} className={inputCls} />
                <select value={staffForm.status} onChange={event => setStaffForm({ ...staffForm, status: event.target.value })} className={inputCls}>
                  <option value="invited">Eingeladen</option><option value="onboarding">Profil offen</option><option value="ready">Bereit</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option>
                </select>
              </>
            )}
            {staffForm.roleId && !hasActiveTemplate(staffForm.roleId) && (
              <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg p-3">
                ⚠️ Für diese Rolle ist keine aktive Vertragsvorlage hinterlegt – die eingeladene Person erhält keinen Vertrag.{" "}
                <button type="button" onClick={goCreateTemplateForRole} className="underline">Jetzt Vorlage anlegen →</button>
              </p>
            )}
            <button type="submit" disabled={busy || initialRoles.length === 0} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-accent-green/90 transition-colors">{busy ? (isEditingStaff ? "Wird gespeichert …" : "Wird eingeladen …") : (isEditingStaff ? "Änderungen speichern" : "Einladung senden")}</button>
            {isEditingStaff && <button type="button" onClick={() => { setIsEditingStaff(false); setStaffForm({ id: "", email: "", firstName: "", lastName: "", phone: "", roleId: initialRoles[0]?.id || "", status: "invited", hourlyRateEuro: "", profitSharePercent: "" }); setMessage(""); }} className="w-full border border-border-light py-2.5 rounded-xl font-bold text-sm hover:bg-canvas-light">Abbrechen</button>}
            {initialRoles.length === 0 && (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Bitte zuerst eine Rolle anlegen.{" "}
                <button type="button" onClick={() => gotoTab("roles")} className="underline">Jetzt Rolle anlegen →</button>
              </p>
            )}
          </form>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
            <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Rollen ({initialRoles.length})</h2>
            {initialRoles.length === 0 ? (
              <p className="p-6 text-base-dark/60">Noch keine Rollen. Lege deine erste Rolle an – z. B. „Servierkraft“.</p>
            ) : (
              <>
              <div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
                <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Vergütung</th><th className="px-4 py-3">Vertrag</th><th className="px-4 py-3">Unterschrift</th><th className="px-4 py-3">Pflichtdokumente</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aktionen</th></tr></thead>
                <tbody>{initialRoles.map(role => (
                  <tr key={role.id} className={`border-t border-border-light ${role.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3 font-bold">{role.name}<div className="text-xs font-normal text-base-dark/50">{role.key}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap">{(role.hourlyRateCents ?? 0) > 0 ? `${(role.hourlyRateCents / 100).toFixed(2)} €/Std.` : ""}{(role.hourlyRateCents ?? 0) > 0 && role.profitSharePercent != null ? " · " : ""}{role.profitSharePercent != null ? `${String(role.profitSharePercent).replace(".", ",")}%` : ""}{(role.hourlyRateCents ?? 0) === 0 && role.profitSharePercent == null ? "—" : ""}</td>
                    <td className="px-4 py-3">
                      {hasActiveTemplate(role.id)
                        ? <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-accent-green/15 text-accent-green">✓ Aktiv</span>
                        : <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">⚠️ Kein aktiver Vertrag</span>}
                    </td>
                    <td className="px-4 py-3">{role.requiresHandwrittenSignature ? "handschriftlich" : "digital"}</td>
                    <td className="px-4 py-3">{role.requiredDocuments.length > 0 ? <span className="text-xs">{role.requiredDocuments.join(", ")}</span> : <span className="text-base-dark/40">—</span>}</td>
                    <td className="px-4 py-3">{role.active ? <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-accent-green/15 text-accent-green">Aktiv</span> : <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Deaktiviert</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button type="button" disabled={busy} onClick={() => startEditRole(role)} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-border-light bg-white text-xs font-bold text-accent-green hover:border-accent-green hover:bg-accent-green/5 disabled:opacity-50 transition-colors" title="Bearbeiten">
                          <Pencil size={13} /> Bearbeiten
                        </button>
                        <button type="button" disabled={busy} onClick={() => toggleRoleActive(role)} className={`inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50 transition-colors ${role.active ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "border-accent-green/40 bg-accent-green/5 text-accent-green hover:bg-accent-green/10"}`} title={role.active ? "Deaktivieren" : "Aktivieren"}>
                          {role.active ? <PowerOff size={13} /> : <Power size={13} />} {role.active ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        {isDev && (
                          <button type="button" disabled={busy} onClick={() => devDeleteRole(role.id, role.name)} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors" title="Nur Dev – endgültig löschen">
                            <Trash2 size={13} /> Dev löschen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>

              <div className="md:hidden divide-y divide-border-light">
                {initialRoles.map(role => (
                  <div key={role.id} className={`p-4 space-y-3 ${role.active ? "" : "opacity-60"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold leading-tight">{role.name}</p>
                        <p className="text-xs text-base-dark/50">{role.key}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${role.active ? "bg-accent-green/15 text-accent-green" : "bg-slate-100 text-slate-700"}`}>{role.active ? "Aktiv" : "Deaktiviert"}</span>
                    </div>
                    <dl className="text-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-3"><dt className="text-base-dark/50 shrink-0">Stundensatz</dt><dd className="font-bold whitespace-nowrap">{(role.hourlyRateCents / 100).toFixed(2)} €/Std.</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt className="text-base-dark/50 shrink-0">Vertrag</dt><dd>{hasActiveTemplate(role.id) ? <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-accent-green/15 text-accent-green">✓ Aktiv</span> : <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">⚠️ Kein aktiver Vertrag</span>}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt className="text-base-dark/50 shrink-0">Unterschrift</dt><dd className="whitespace-nowrap">{role.requiresHandwrittenSignature ? "handschriftlich" : "digital"}</dd></div>
                      <div className="flex items-start justify-between gap-3"><dt className="text-base-dark/50 shrink-0">Pflichtdokumente</dt><dd className="text-right text-xs">{role.requiredDocuments.length > 0 ? role.requiredDocuments.join(", ") : <span className="text-base-dark/40">—</span>}</dd></div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => startEditRole(role)} className={`${mBtn} border-border-light bg-white text-accent-green hover:border-accent-green hover:bg-accent-green/5`}><Pencil size={14} /> Bearbeiten</button>
                      <button type="button" disabled={busy} onClick={() => toggleRoleActive(role)} className={`${mBtn} ${role.active ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "border-accent-green/40 bg-accent-green/5 text-accent-green hover:bg-accent-green/10"}`}>
                        {role.active ? <PowerOff size={14} /> : <Power size={14} />} {role.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      {isDev && (
                        <button type="button" disabled={busy} onClick={() => devDeleteRole(role.id, role.name)} className={`${mBtn} border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100`}><Trash2 size={14} /> Dev löschen</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>

          <form onSubmit={createNewRole} className="bg-white border border-border-light rounded-2xl p-5 space-y-4 h-fit shadow-sm">
            <h2 className="font-display font-bold text-xl">{editingRoleId ? "Rolle bearbeiten" : "Neue Rolle"}</h2>
            <Help>
              <p>Eine Rolle entspricht einem Job im Team (z. B. „Servierkraft“ oder „Küchenhilfe“). Alle Personen mit dieser Rolle bekommen denselben Stundensatz.</p>
              <ul>
                <li><strong>Name:</strong> So heißt der Job im Team.</li>
                <li><strong>Kennung (Schlüssel):</strong> Technischer Name für die computerinterne Zuordnung – wird aus dem Namen erzeugt, z. B. „servierkraft“. Nur ändern, wenn du weißt, was du tust.</li>
                <li><strong>Stundensatz:</strong> Gib den Betrag einfach in Euro ein, z. B. „13,50“ für 13,50 € pro Stunde. Er wird automatisch korrekt gespeichert.</li>
                <li><strong>Welche Dokumente braucht die Person?</strong> Hake ab, was die Person vor Arbeitsbeginn hochladen muss. Nichts auswählen = keine Dokumente nötig.</li>
                <li><strong>Handschriftliche Unterschrift:</strong> Die Person muss den Vertrag ausdrucken, unterschreiben und einscannen – statt mit einem Klick zu bestätigen. Nur nötig, wo das rechtlich verlangt ist.</li>
              </ul>
            </Help>
            <input required placeholder="Name der Rolle, z. B. Servierkraft" value={roleForm.name} onChange={event => {
              const name = event.target.value;
              setRoleForm(prev => ({ ...prev, name, key: keyTouched ? prev.key : slugify(name) }));
            }} className={inputCls} />
            <input disabled={!!editingRoleId} required placeholder="Kennung (Schlüssel), z. B. servierkraft" value={roleForm.key} onChange={event => { setKeyTouched(true); setRoleForm({ ...roleForm, key: event.target.value }); }} className={`${inputCls} disabled:opacity-50`} />
            {editingRoleId && <p className="text-xs text-base-dark/50">Die Kennung (Schlüssel) kann bei bestehenden Rollen nicht geändert werden.</p>}
            <div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Stundensatz in Euro, z. B. 13,50"
                  value={roleForm.hourlyRateEuro}
                  onChange={event => setRoleForm({ ...roleForm, hourlyRateEuro: event.target.value })}
                  className={`${inputCls} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-base-dark/50">€/Std.</span>
              </div>
              {roleForm.hourlyRateEuro && euroToCents(roleForm.hourlyRateEuro) > 0 && (
                <p className="mt-1 text-xs text-accent-green font-bold">= {(euroToCents(roleForm.hourlyRateEuro) / 100).toFixed(2)} € pro Stunde</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 opacity-70">Umsatzbeteiligung (%)</label>
              <input type="number" min={0} max={100} step="0.1" inputMode="decimal" placeholder="optional, z. B. 5" value={roleForm.profitSharePercent} onChange={event => setRoleForm({ ...roleForm, profitSharePercent: event.target.value })} className={inputCls} />
            </div>
            <div className="flex flex-wrap gap-2">
              {DOC_OPTIONS.map(doc => {
                const active = roleForm.requiredDocuments.includes(doc);
                return (
                  <button
                    key={doc}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDoc(doc)}
                    className={`min-h-10 px-3 py-2 rounded-full text-xs font-bold border transition-all duration-150 ${active ? "bg-accent-green text-white border-accent-green shadow-sm" : "bg-canvas-light text-base-dark/60 border-border-light hover:border-accent-green/50 hover:text-base-dark"}`}
                  >
                    {active ? "✓ " : ""}{doc}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input type="checkbox" checked={roleForm.requiresHandwrittenSignature} onChange={event => setRoleForm({ ...roleForm, requiresHandwrittenSignature: event.target.checked })} className="w-5 h-5 accent-accent-green shrink-0" /> Handschriftliche Unterschrift
            </label>
            <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-accent-green/90 transition-colors">{busy ? "Wird gespeichert …" : editingRoleId ? "Änderungen speichern" : "Rolle anlegen"}</button>
            {editingRoleId && <button type="button" onClick={cancelEditRole} className="w-full border border-border-light py-2.5 rounded-xl font-bold text-sm hover:bg-canvas-light">Abbrechen</button>}
          </form>
        </div>
      )}

      {tab === "contracts" && (
         <>
           <div className="bg-white border border-border-light rounded-2xl p-5 shadow-sm mb-6">
             <h2 className="font-display font-bold text-xl mb-3">Rollen und ihre Vertraege</h2>
             <p className="text-sm text-base-dark/60 mb-3">Uebersicht, welche Rolle bereits einen aktiven Vertrag hat.</p>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {initialRoles.map(role => {
                 const tpl = initialTemplates.filter(t => t.role?.id === role.id && t.template.status === "active").sort((a, b) => b.template.version - a.template.version)[0];
                 return (
                   <div key={role.id} className={`rounded-xl border p-3 ${tpl ? "border-accent-green/40 bg-accent-green/5" : "border-amber-200 bg-amber-50"}`}>
                     <div className="font-bold text-sm">{role.name}</div>
                     {tpl ? (
                       <div className="text-xs text-accent-green mt-1">OK {tpl.template.name} (v{tpl.template.version})</div>
                     ) : (
                       <div className="text-xs text-amber-800 mt-1">Kein aktiver Vertrag</div>
                     )}
                   </div>
                 );
               })}
             </div>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6">
          <div className="order-1 lg:order-2 bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
            <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Vertragsvorlagen ({initialTemplates.length})</h2>
            {initialTemplates.length === 0 ? (
              <p className="p-6 text-base-dark/60">Noch keine Vorlagen. Neue Teammitglieder erhalten automatisch ihren Vertrag, sobald du eine Vorlage anlegst.</p>
            ) : (
              <>
              <div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
                <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Vorlage</th><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Unterschrift</th><th className="px-4 py-3">Aktionen</th></tr></thead>
                <tbody>{initialTemplates.map(({ template, role }) => {
                  const status = TEMPLATE_STATUS_META[template.status] || TEMPLATE_STATUS_META.draft;
                  return (
                    <tr key={template.id} className="border-t border-border-light">
                      <td className="px-4 py-3 font-bold">{template.name}</td>
                      <td className="px-4 py-3">{role?.name || "—"}</td>
                      <td className="px-4 py-3">v{template.version}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span></td>
                      <td className="px-4 py-3">{template.signatureMode === "handwritten" ? "handschriftlich" : "digital"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button type="button" onClick={() => { loadExistingTemplate(template.id); setContractViewMode("live"); }} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-border-light bg-white text-xs font-bold text-accent-green hover:border-accent-green hover:bg-accent-green/5 transition-colors" title="Live View ansehen">👁 Ansehen</button>
                          <button type="button" disabled={busy} onClick={() => deleteTemplate(template.id, template.name, template.status)} className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-9 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors" title="Vorlage löschen">
                            <Trash2 size={13} /> Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>

              <div className="md:hidden divide-y divide-border-light">
                {initialTemplates.map(({ template, role }) => {
                  const status = TEMPLATE_STATUS_META[template.status] || TEMPLATE_STATUS_META.draft;
                  return (
                    <div key={template.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold leading-tight">{template.name}</p>
                          <p className="text-xs text-base-dark/50">{role?.name || "—"} · v{template.version} · {template.signatureMode === "handwritten" ? "handschriftlich" : "digital"}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { loadExistingTemplate(template.id); setContractViewMode("live"); }} className={`${mBtn} border-accent-green/40 bg-white text-accent-green hover:bg-accent-green/5`}>👁 Ansehen</button>
                        <button type="button" disabled={busy} onClick={() => deleteTemplate(template.id, template.name, template.status)} className={`${mBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}><Trash2 size={14} /> Löschen</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>

          <form onSubmit={createTemplate} className="order-2 lg:order-1 lg:col-span-2 bg-white border border-border-light rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="font-display font-bold text-xl">Neuer Vertrag – in 3 Schritten</h2>
            <p className="text-sm text-base-dark/60">Du musst nichts Technisches eingeben. Folge einfach den Schritten.</p>
            {initialTemplates.length > 0 && (
              <div className="rounded-xl bg-canvas-light border border-border-light p-3 space-y-2">
                <label htmlFor="template-copy" className="text-sm font-bold">Du hast schon eine Vorlage?</label>
                <select id="template-copy" defaultValue="" onChange={(e) => { if (e.target.value) loadExistingTemplate(e.target.value); e.target.value = ""; }} className={inputCls}>
                  <option value="">Vorhandenen Text übernehmen …</option>
                  {initialTemplates.map(({ template }) => <option key={template.id} value={template.id}>{template.name} v{template.version} – Text übernehmen</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 text-xs font-bold">
              {[["1", "Rolle & Unterschrift"], ["2", "Text"], ["3", "Prüfen & Speichern"]].map(([num, label]) => (
                <span key={num} className={`flex-1 text-center rounded-lg px-1 py-2 ${contractStep === Number(num) ? "bg-accent-green text-white" : "bg-canvas-light text-base-dark/50"}`}>{num}. {label}</span>
              ))}
            </div>
            {contractStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <fieldset>
                  <legend className="text-sm font-bold mb-2">1. Für wen ist dieser Vertrag?</legend>
                  <div className="flex flex-wrap gap-2">
                    {initialRoles.filter(role => !hasActiveTemplate(role.id)).map(role => (
                      <button key={role.id} type="button" onClick={() => {
                        const activeTpl = initialTemplates
                          .filter(({ template }) => template.roleId === role.id && template.status === "active")
                          .sort((a, b) => b.template.version - a.template.version)[0];
                        setTemplateForm(prev => {
                          if (activeTpl) {
                            return { ...prev, roleId: role.id, name: `${activeTpl.template.name} (Kopie)`, bodyHtml: activeTpl.template.bodyHtml, signatureMode: activeTpl.template.signatureMode as "text" | "handwritten" };
                          }
                          // Keine aktive Vorlage: Text bleibt unverändert – Stundensatz/Umsatzbeteiligung
                          // werden beim Rendern des Vertrags automatisch anhand der Rolle ein-/ausgeblendet ({{#if ...}}).
                          return { ...prev, roleId: role.id, bodyHtml: prev.bodyHtml };
                        });
                        if (activeTpl) setMessage(`Aktive Vorlage „${activeTpl.template.name}" für diese Rolle geladen – du kannst sie jetzt anpassen.`);
                        else setMessage("Der Vertragstext passt sich beim Rendern automatisch an (Stundensatz/Umsatzbeteiligung je nach Rolle).");
                      }} aria-pressed={templateForm.roleId === role.id} className={`min-h-10 px-3 py-2 rounded-full text-xs font-bold border ${templateForm.roleId === role.id ? "bg-accent-green text-white border-accent-green" : "bg-canvas-light border-border-light"}`}>{templateForm.roleId === role.id ? "✓ " : ""}{role.name}</button>
                    ))}
                  </div>
                  <input required placeholder="Name der Vorlage, z. B. Arbeitsvertrag" value={templateForm.name} onChange={event => setTemplateForm({ ...templateForm, name: event.target.value })} className={`${inputCls} mt-3`} />
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-bold mb-2">2. Wie soll unterschrieben werden?</legend>
                  {([
                    { value: "text" as const, title: "Einfach mit einem Klick", desc: "Empfohlen – die Person bestätigt direkt am Bildschirm. Schnell und ohne Drucker." },
                    { value: "handwritten" as const, title: "Ausdrucken & einscannen", desc: "Nur wenn es sein muss – die Person druckt, unterschreibt von Hand und lädt den Scan hoch." },
                  ]).map(option => (
                    <label key={option.value} className={`flex gap-3 items-start rounded-xl border p-3 mb-2 cursor-pointer ${templateForm.signatureMode === option.value ? "border-accent-green bg-accent-green/5" : "border-border-light"}`}>
                      <input type="radio" name="signatureMode" checked={templateForm.signatureMode === option.value} onChange={() => setTemplateForm({ ...templateForm, signatureMode: option.value })} className="mt-1 accent-accent-green" />
                      <span><span className="block text-sm font-bold">{option.title}</span><span className="block text-xs text-base-dark/60 mt-1">{option.desc}</span></span>
                    </label>
                  ))}
                </fieldset>
                <button type="button" disabled={!templateForm.roleId || !templateForm.name.trim()} onClick={() => setContractStep(2)} className="md:col-span-2 w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">Weiter zu Schritt 2 →</button>
              </div>
            )}
            {contractStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm font-bold">3. Schreibe deinen Vertragstext (ganz normal wie in Word)</p>
                <div className="grid grid-cols-2 bg-canvas-light p-1 rounded-xl border border-border-light" role="tablist" aria-label="Text oder Live-Vorschau">
                  <button type="button" role="tab" aria-selected={contractViewMode === "editor"} onClick={() => setContractViewMode("editor")} className={`min-h-11 rounded-lg font-bold text-sm ${contractViewMode === "editor" ? "bg-white shadow-sm" : "text-base-dark/50"}`}>✏️ Text bearbeiten</button>
                  <button type="button" role="tab" aria-selected={contractViewMode === "live"} onClick={() => setContractViewMode("live")} className={`min-h-11 rounded-lg font-bold text-sm ${contractViewMode === "live" ? "bg-white shadow-sm" : "text-base-dark/50"}`}>👁 Live View</button>
                </div>
                {contractViewMode === "editor" ? (
                  <div className="bg-white rounded-lg overflow-hidden border border-border-light">
                    <ReactQuill theme="snow" value={templateForm.bodyHtml} onChange={(content) => setTemplateForm({ ...templateForm, bodyHtml: content })} className="min-h-[180px]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs font-bold space-y-1">Beispiel-Name<input value={previewExample.name} onChange={event => setPreviewExample({ ...previewExample, name: event.target.value })} className={`${inputCls} mt-1`} /></label>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-base-dark/40 mb-2">So sieht es der Mitarbeiter · {selectedRoleName} · {templateForm.signatureMode === "handwritten" ? "Handschriftlich" : "Digital"}</p>
                      <div className="bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-10 text-sm sm:text-base leading-relaxed max-h-80 overflow-auto [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_table]:border [&_td]:border [&_td]:border-border-light [&_td]:p-1" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      {templateForm.signatureMode === "text" ? (
                        <div className="mt-3 bg-white rounded-lg border border-border-light p-3 text-sm space-y-2">
                          <label className="flex gap-2 items-center"><input type="checkbox" readOnly checked={false} className="w-5 h-5 accent-accent-green" /> Ich habe den Vertrag gelesen und akzeptiere ihn</label>
                          <p className="text-xs text-base-dark/50">Name: <strong>{previewExample.name || "Max Mustermann"}</strong> · Button: &ldquo;Digital unterschreiben&rdquo;</p>
                        </div>
                      ) : (
                        <div className="mt-3 bg-white rounded-lg border border-border-light p-3 text-sm">
                          <p className="font-bold">Unterschreiben: Vertrag drucken → unterschreiben → als Foto/PDF hochladen</p>
                          <p className="text-xs text-base-dark/50 mt-1">Keine Checkbox – hier wird ein Scan hochgeladen.</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-base-dark/50">Grün markiert = wird automatisch eingetragen. Aktualisiert sich sofort beim Tippen.</p>
                  </div>
                )}
                <div className="rounded-xl bg-canvas-light border border-border-light p-3">
                  <p className="text-sm font-bold mb-2">Was soll automatisch eingetragen werden? Tippe nichts – tippe einfach an:</p>
                  <div className="flex flex-wrap gap-2">
                    {CONTRACT_PLACEHOLDERS.map(item => <button key={item.token} type="button" onClick={() => insertPlaceholder(item.token)} className="min-h-10 px-3 py-2 rounded-full text-xs font-bold border bg-white border-border-light hover:border-accent-green">＋ {item.label}</button>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setContractStep(1)} className="flex-1 border border-border-light py-3 rounded-xl font-bold">← Zurück</button>
                  <button type="button" disabled={templateForm.bodyHtml.replace(/<[^>]*>/g, "").trim().length < 20} onClick={() => setContractStep(3)} className="flex-1 bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">Weiter zu Schritt 3 →</button>
                </div>
                {templateForm.bodyHtml.replace(/<[^>]*>/g, "").trim().length < 20 && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">Bitte schreibe noch etwas mehr Text (mindestens ein paar Sätze).</p>}
              </div>
            )}
            {contractStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm font-bold">4. So sieht die Person ihren Vertrag (Beispiel)</p>
                <div className="bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-10 text-sm sm:text-base leading-relaxed max-h-72 overflow-auto [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:my-2" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <p className="text-xs text-base-dark/50">Grün markiert = das wird automatisch für jede Person eingetragen (Name, Rolle, Stundensatz …).</p>
                <label className="flex items-start gap-2 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={templateForm.status === "active"} onChange={event => setTemplateForm({ ...templateForm, status: event.target.checked ? "active" : "draft" })} className="w-5 h-5 mt-0.5 accent-accent-green shrink-0" />
                  <span>Sofort nutzen – sobald ich speichere, bekommen neue Mitarbeiter genau diesen Vertrag.<span className="block text-xs font-normal text-base-dark/60 mt-1">Unangemacht = nur als Entwurf speichern, noch nichts wird genutzt.</span></span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setContractStep(2)} className="flex-1 border border-border-light py-3 rounded-xl font-bold">← Zurück</button>
                  <button type="submit" disabled={busy || !templateForm.roleId} className="flex-1 bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert …" : "Vertrag speichern"}</button>
                </div>
              </div>
            )}
            {initialRoles.length === 0 && (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Bitte zuerst eine Rolle anlegen.{" "}
                <button type="button" onClick={() => gotoTab("roles")} className="underline">Jetzt Rolle anlegen →</button>
              </p>
            )}
          </form>
        </div>
         </>

      )}
      {tab === "minijob" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6">
          <div className="order-1 lg:order-2 bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
            <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Aktuelles Formular</h2>
            {minijobTemplate ? (
              <div className="p-5 space-y-3">
                <p className="font-bold">{minijobTemplate.name}</p>
                <p>{minijobTemplate.status === "active"
                  ? <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-accent-green/15 text-accent-green">✓ Aktiv – wird automatisch erstellt</span>
                  : <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Entwurf – nicht aktiv</span>}</p>
                <p className="text-xs text-base-dark/50">Erstellt von {minijobTemplate.createdBy}</p>
                <button type="button" onClick={() => { setMinijobStep(2); setMinijobViewMode("live"); }} className="w-full min-h-11 border border-accent-green/40 text-accent-green rounded-xl font-bold hover:bg-accent-green/5">👁 Live View ansehen</button>
              </div>
            ) : (
              <p className="p-6 text-base-dark/60">Noch kein Minijob-Formular angelegt. Bearbeite dein Formular und schalte es auf Aktiv – danach wird es beim Onboarding automatisch aus den Daten der Person erstellt.</p>
            )}
          </div>

          <form onSubmit={saveMinijob} className="order-2 lg:order-1 lg:col-span-2 bg-white border border-border-light rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="font-display font-bold text-xl">Minijob-Formular – in 3 Schritten</h2>
            <p className="text-sm text-base-dark/60">Das Formular wird automatisch aus den Onboarding-Daten erstellt – du musst keine Daten abtippen.</p>
            <div className="flex gap-2 text-xs font-bold">
              {[["1", "Name & Aktivierung"], ["2", "Text"], ["3", "Prüfen & Speichern"]].map(([num, label]) => (
                <span key={num} className={`flex-1 text-center rounded-lg px-1 py-2 ${minijobStep === Number(num) ? "bg-accent-green text-white" : "bg-canvas-light text-base-dark/50"}`}>{num}. {label}</span>
              ))}
            </div>
            {minijobStep === 1 && (
              <div className="space-y-4">
                <label className="text-sm font-bold space-y-2 block">Name des Formulars
                  <input required placeholder="Name, z. B. Minijob-Formular" value={minijobForm.name} onChange={event => setMinijobForm({ ...minijobForm, name: event.target.value })} className={`${inputCls} mt-1`} />
                </label>
                <label className="flex items-start gap-2 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={minijobForm.status === "active"} onChange={event => setMinijobForm({ ...minijobForm, status: event.target.checked ? "active" : "draft" })} className="w-5 h-5 mt-0.5 accent-accent-green shrink-0" />
                  <span>Sofort nutzen – sobald ich speichere, wird das Formular für neue Mitarbeiter automatisch erstellt.<span className="block text-xs font-normal text-base-dark/60 mt-1">Unangemacht = nur als Entwurf speichern, noch nichts wird erstellt.</span></span>
                </label>
                <button type="button" disabled={!minijobForm.name.trim()} onClick={() => setMinijobStep(2)} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">Weiter zu Schritt 2 →</button>
              </div>
            )}
            {minijobStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm font-bold">2. Schreibe deinen Text (ganz normal wie in Word)</p>
                <div className="grid grid-cols-2 bg-canvas-light p-1 rounded-xl border border-border-light" role="tablist" aria-label="Text oder Live-Vorschau">
                  <button type="button" role="tab" aria-selected={minijobViewMode === "editor"} onClick={() => setMinijobViewMode("editor")} className={`min-h-11 rounded-lg font-bold text-sm ${minijobViewMode === "editor" ? "bg-white shadow-sm" : "text-base-dark/50"}`}>✏️ Text bearbeiten</button>
                  <button type="button" role="tab" aria-selected={minijobViewMode === "live"} onClick={() => setMinijobViewMode("live")} className={`min-h-11 rounded-lg font-bold text-sm ${minijobViewMode === "live" ? "bg-white shadow-sm" : "text-base-dark/50"}`}>👁 Live View</button>
                </div>
                {minijobViewMode === "editor" ? (
                  <div className="bg-white rounded-lg overflow-hidden border border-border-light">
                    <ReactQuill theme="snow" value={minijobForm.bodyHtml} onChange={(content) => setMinijobForm({ ...minijobForm, bodyHtml: content })} className="min-h-[180px]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs font-bold space-y-1">Beispiel-Name<input value={previewExample.name} onChange={event => setPreviewExample({ ...previewExample, name: event.target.value })} className={`${inputCls} mt-1`} /></label>
                      <label className="text-xs font-bold space-y-1">Beispiel-Stundensatz<input value={previewExample.rate} onChange={event => setPreviewExample({ ...previewExample, rate: event.target.value })} className={`${inputCls} mt-1`} /></label>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-base-dark/40 mb-2">So sieht es der Mitarbeiter · Minijob-Formular (PDF)</p>
                      <div className="bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-10 text-sm sm:text-base leading-relaxed max-h-80 overflow-auto [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_table]:border [&_td]:border [&_td]:border-border-light [&_td]:p-1" dangerouslySetInnerHTML={{ __html: minijobPreviewHtml }} />
                      <p className="text-xs text-base-dark/50 mt-3">Das wird als fertiges PDF erstellt. Grün markiert = wird automatisch aus den Daten eingetragen.</p>
                    </div>
                  </div>
                )}
                <div className="rounded-xl bg-canvas-light border border-border-light p-3">
                  <p className="text-sm font-bold mb-2">Was soll automatisch eingetragen werden? Tippe nichts – tippe einfach an:</p>
                  <div className="flex flex-wrap gap-2">
                    {MINIJOB_PLACEHOLDERS.map(item => <button key={item.token} type="button" onClick={() => insertMinijobPlaceholder(item.token)} className="min-h-10 px-3 py-2 rounded-full text-xs font-bold border bg-white border-border-light hover:border-accent-green">＋ {item.label}</button>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMinijobStep(1)} className="flex-1 border border-border-light py-3 rounded-xl font-bold">← Zurück</button>
                  <button type="button" disabled={minijobForm.bodyHtml.replace(/<[^>]*>/g, "").trim().length < 20} onClick={() => setMinijobStep(3)} className="flex-1 bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">Weiter zu Schritt 3 →</button>
                </div>
                {minijobForm.bodyHtml.replace(/<[^>]*>/g, "").trim().length < 20 && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">Bitte schreibe noch etwas mehr Text (mindestens ein paar Sätze).</p>}
              </div>
            )}
            {minijobStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm font-bold">3. So sieht die Person ihr Formular (Beispiel)</p>
                <div className="bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-10 text-sm sm:text-base leading-relaxed max-h-72 overflow-auto [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:my-2" dangerouslySetInnerHTML={{ __html: minijobPreviewHtml }} />
                <p className="text-xs text-base-dark/50">Grün markiert = das wird automatisch für jede Person eingetragen (Name, Adresse, Steuer-ID, IBAN …).</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMinijobStep(2)} className="flex-1 border border-border-light py-3 rounded-xl font-bold">← Zurück</button>
                  <button type="submit" disabled={busy} className="flex-1 bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert …" : "Formular speichern"}</button>
                </div>
                {minijobForm.id && (
                  <button type="button" disabled={busy} onClick={removeMinijob} className="w-full border border-red-200 text-red-700 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50">Formular löschen</button>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
