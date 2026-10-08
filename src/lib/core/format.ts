/* Números, montos y fechas en formato argentino. */

export const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const NF1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export const r2 = (v: number) => Math.round(v * 100) / 100;

export const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);

/** Precio de venta: sin decimales si hay redondeo a $ 1 o más, o si es entero. */
export function priceTxt(v: number | null | undefined, round: number): string {
  if (v == null || !isFinite(v)) return "—";
  const step = +round || 0;
  return step >= 1 || Number.isInteger(v) ? NF0.format(Math.round(v)) : NF2.format(v);
}
export const costTxt = (v: number | null | undefined) => (v == null || !isFinite(v) ? "—" : "$ " + NF2.format(v));
export const pctTxt = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + NF1.format(Math.abs(v)) + " %";

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ago(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return "nunca";
  const d = Math.floor((now - ts) / 86400000);
  if (d <= 0) {
    const h = Math.floor((now - ts) / 3600000);
    return h <= 0 ? "recién" : `hace ${h} h`;
  }
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m === 1 ? "hace 1 mes" : `hace ${m} meses`;
}

/** Números en formato argentino o internacional: "1.234,56" → 1234.56; "12.500" → 12500; "1,5" → 1.5 */
export function parseNum(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  let s = String(v ?? "").trim();
  if (!s) return NaN;
  s = s.replace(/[$\s]|ars|u\$s|usd/gi, "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return NaN;
  const lc = s.lastIndexOf(","),
    ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) {
    if (lc > ld) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lc > -1) {
    const dec = s.length - lc - 1;
    s =
      dec === 3 && (s.match(/,/g) || []).length >= 1 && s.length > 4 && !/^0,/.test(s)
        ? s.replace(/,/g, "")
        : s.replace(/,/g, (_m, i: number) => (i === lc ? "." : ""));
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  } else if (ld > -1) {
    const parts = s.split(".");
    if (parts.length > 2) s = s.replace(/\./g, "");
    else if (parts[1].length === 3 && parts[0].length >= 1 && parts[0] !== "0") s = s.replace(".", "");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/** "YERBA PLAYADITO 500GR" → "Yerba Playadito 500 g" */
export function tidyName(input: string): string {
  let s = String(input).replace(/\s+/g, " ").trim();
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/(^|[\s(/-])([a-záéíóúñü])/g, (_m, a: string, b: string) => a + b.toUpperCase());
    const U: Record<string, string> = { kg: "kg", kgs: "kg", gr: "g", grs: "g", g: "g", ml: "ml", cc: "cc", lt: "l", lts: "l", l: "l", un: "u", u: "u" };
    s = s.replace(/\b(\d+(?:[.,]\d+)?)\s?(kgs?|grs?|g|ml|cc|lts?|l|un|u)\b/gi, (_m, n: string, u: string) => n + " " + U[u.toLowerCase()]);
    s = s.replace(/\b(De|Del|La|El|Con|Sin|En|Y|X|Para)\b/g, (w) => w.toLowerCase());
    s = s[0].toUpperCase() + s.slice(1);
  }
  return s;
}

export const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fileSafe = (s: string) =>
  String(s || "comercio")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
