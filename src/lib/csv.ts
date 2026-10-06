/**
 * Minimal RFC 4180 CSV. A field is quoted when it contains a comma, quote or
 * newline, and embedded quotes are doubled — enough for spreadsheet imports
 * without pulling in a dependency.
 */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return (columns ?? []).join(",");
  const cols = columns ?? Object.keys(rows[0]!);
  const header = cols.map(escapeField).join(",");
  const body = rows.map((row) => cols.map((c) => escapeField(row[c])).join(","));
  return [header, ...body].join("\r\n");
}
