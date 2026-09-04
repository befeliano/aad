/* Ortak formatlayıcılar */

export const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(
    Number(n || 0)
  );

export const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const fmtDateTime = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** "14:30" biçimine indirger (Postgres time "14:30:00") */
export const fmtTime = (t: string | null | undefined) =>
  t ? t.slice(0, 5) : "—";

/** Saniye → "12:34" */
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------- CSV ---------- */

/** Bir hücreyi CSV için güvenli hale getirir (injection'a karşı da korur) */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Formül enjeksiyonunu engelle
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Satırları CSV metnine çevirir (Excel-TR uyumu için ; ayırıcı + BOM) */
export function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(";")];
  rows.forEach((r) => lines.push(r.map(csvCell).join(";")));
  return "﻿" + lines.join("\r\n");
}

/** Tarayıcıda dosya indirir */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mime = "text/csv;charset=utf-8"
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Basit CSV ayrıştırıcı — ; veya , ayırıcı, tırnaklı alan desteği */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const delim = (clean.split("\n")[0].match(/;/g) || []).length >=
    (clean.split("\n")[0].match(/,/g) || []).length
    ? ";"
    : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n") {
      row.push(cell.trim());
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}
