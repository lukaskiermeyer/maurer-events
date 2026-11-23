/** Escape CSV data and prevent spreadsheet applications from evaluating formulas. */
export function csvCell(value: unknown, separator = ","): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value) ? value.join("|") : String(value);
  // Leading whitespace does not make formula input safe in spreadsheet programs.
  if (/^(?:\s*[=+\-@]|[\t\r\n])/.test(text)) text = `'${text}`;
  if (text.includes(separator) || /["\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
