import type { StaffRecord, StaffRole } from "@/types/domain";
import { decryptField } from "./secure-fields";

const HEADERS = [
  "Personalnummer", "Anrede", "Titel", "Vorname", "Nachname", "Geburtsdatum", "Straße", "PLZ", "Ort",
  "Eintritt", "Austritt", "Beschäftigungsart", "Rolle", "Stundensatz", "Gewinnbeteiligung (%)", "Monatsgehalt",
  "Steuer-ID", "Steuerklasse", "Kinderfreibeträge", "SV-Nummer", "Krankenkasse", "IBAN", "BIC", "Status",
];

const EMPLOYMENT_LABELS: Record<string, string> = {
  minijob: "Minijob",
  short_term: "Kurzfristig",
  student: "Werkstudent",
  employed: "Angestellt",
};

function date(value: Date | string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("de-DE") : "";
}

function money(cents: number | null | undefined) {
  return ((cents || 0) / 100).toFixed(2).replace(".", ",");
}

function decrypted(value: string | null | undefined) {
  try { return decryptField(value) || ""; } catch { return ""; }
}

export function payrollRow(member: StaffRecord, role: StaffRole | null) {
  return [
    member.id.slice(0, 8).toUpperCase(),
    "",
    "",
    member.firstName,
    member.lastName,
    date(member.birthDate),
    [member.street, member.houseNumber].filter(Boolean).join(" ") || "",
    member.zip || "",
    member.city || "",
    date(member.entryDate),
    date(member.exitDate),
    EMPLOYMENT_LABELS[member.employmentType] || member.employmentType,
    role?.name || "",
    money(member.hourlyRateCents),
    member.profitSharePercent === null || member.profitSharePercent === undefined ? "" : String(member.profitSharePercent).replace(".", ","),
    money(member.monthlySalaryCents),
    decrypted(member.taxIdEnc),
    member.taxClass || "",
    String(member.childAllowances || 0),
    decrypted(member.socialSecurityEnc),
    member.healthInsurance || "",
    decrypted(member.ibanEnc),
    member.bic || "",
    member.status,
  ];
}

function csvCell(value: string, separator = ";") {
  if (value.includes(separator) || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildPayrollCsv(rows: string[][]) {
  return `\uFEFF${[HEADERS, ...rows].map(row => row.map(value => csvCell(value)).join(";")).join("\r\n")}\r\n`;
}

export function missingPayrollFields(member: StaffRecord) {
  const missing: string[] = [];
  if (!member.firstName) missing.push("Vorname");
  if (!member.lastName) missing.push("Nachname");
  if (!member.birthDate) missing.push("Geburtsdatum");
  if (!member.street) missing.push("Straße");
  if (!member.zip) missing.push("PLZ");
  if (!member.city) missing.push("Ort");
  if (!member.entryDate) missing.push("Eintrittsdatum");
  if (!member.employmentType) missing.push("Beschäftigungsart");
  if (!member.taxIdEnc) missing.push("Steuer-ID");
  if (!member.taxClass) missing.push("Steuerklasse");
  if (!member.socialSecurityEnc) missing.push("Sozialversicherungsnummer");
  if (!member.healthInsurance) missing.push("Krankenkasse");
  if (!member.ibanEnc) missing.push("IBAN");
  return missing;
}

export const PAYROLL_HEADERS = HEADERS;