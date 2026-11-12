export type CustomerField = "displayName" | "company" | "email" | "phone" | "street" | "zip" | "city" | "notes" | "externalRef";

export const CUSTOMER_FIELDS: { key: CustomerField; label: string; required?: boolean }[] = [
  { key: "displayName", label: "Name", required: true },
  { key: "company", label: "Verein / Firma" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
  { key: "street", label: "Straße" },
  { key: "zip", label: "PLZ" },
  { key: "city", label: "Ort" },
  { key: "notes", label: "Notizen" },
  { key: "externalRef", label: "Externe ID (SnapTicket)" },
];

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/).find(line => line.trim()) || "";
  const delimiter = (firstLine.match(/;/g)?.length || 0) >= (firstLine.match(/,/g)?.length || 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === delimiter) { row.push(cell); cell = ""; continue; }
    if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (char === "\r") continue;
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  const cleaned = rows.filter(r => r.some(value => value.trim().length > 0));
  const headers = (cleaned.shift() || []).map(value => value.trim());
  return { headers, rows: cleaned };
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizePhone(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") || "";
  return digits.length >= 6 ? digits : "";
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type MappedCustomerRow = { rowNumber: number } & Record<CustomerField, string>;

export function mapImportRows(headers: string[], rows: string[][], mapping: Partial<Record<CustomerField, number>>): MappedCustomerRow[] {
  return rows.slice(0, 2000).map((row, index) => {
    const result = {} as Record<CustomerField, string>;
    for (const field of CUSTOMER_FIELDS) {
      const column = mapping[field.key];
      result[field.key] = column !== undefined && column >= 0 ? (row[column] || "").trim() : "";
    }
    return { rowNumber: index + 2, ...result };
  });
}