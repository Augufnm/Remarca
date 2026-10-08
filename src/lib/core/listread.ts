/* Lectura de listas sin IA: planillas (columnas) y texto (última cifra con forma de precio). */
import { parseNum } from "./format";
import { itemKey } from "./match";
import type { RawItem, SheetCols } from "./types";

export type Cell = string | number | boolean | null | undefined;
export type Rows = Cell[][];

const KW = {
  code: /^(cod|c[oó]d(igo)?|sku|art(\.|[ií]culo)?\s*(n|nro|#)?|ean|ref|item|id|plu)\b/i,
  desc: /(desc|producto|art[ií]culo|detalle|nombre|item|mercader)/i,
  cost: /(costo|precio|p\.?\s?unit|unitario|lista|neto|importe|valor|\$|pcio|final)/i,
  cat: /(rubro|categor|familia|secci[oó]n|grupo|l[ií]nea)/i,
  price: /(venta|p\.?\s?v\.?p|p[uú]blico|pvp|precio\s*sug)/i,
};

export interface GuessedCols extends SheetCols {
  cat: number;
  price: number;
}

export function guessCols(rows: Rows, forCatalog: boolean): GuessedCols {
  let hdr = -1,
    best = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i];
    let sc = 0;
    for (const c of r) {
      const s = String(c);
      if (typeof c === "string" && s.length < 40 && (KW.desc.test(s) || KW.cost.test(s) || KW.code.test(s) || KW.cat.test(s))) sc++;
    }
    if (sc > best) {
      best = sc;
      hdr = i;
    }
  }
  const H = hdr >= 0 ? rows[hdr].map(String) : [];
  const data = rows.slice(hdr + 1, hdr + 60);
  const ncol = Math.max(...rows.slice(0, 60).map((r) => r.length), 0);
  const numRatio = (j: number) => {
    let n = 0,
      t = 0;
    for (const r of data) {
      const v = r[j];
      if (v === "" || v == null) continue;
      t++;
      if (isFinite(parseNum(v)) && parseNum(v) > 0) n++;
    }
    return t ? n / t : 0;
  };
  const textLen = (j: number) => {
    let L = 0,
      t = 0;
    for (const r of data) {
      const v = r[j];
      if (typeof v === "string" && /[a-záéíóúñ]/i.test(v)) {
        L += v.length;
        t++;
      }
    }
    return t ? L / Math.max(1, data.length) : 0;
  };
  const find = (re: RegExp, not?: number[]) => {
    for (let j = 0; j < H.length; j++) if (re.test(H[j]) && !(not && not.some((x) => x === j))) return j;
    return -1;
  };
  const cols: GuessedCols = { header: hdr, code: -1, desc: -1, cost: -1, cat: -1, price: -1 };
  cols.code = find(KW.code);
  cols.desc = find(KW.desc, [cols.code]);
  if (forCatalog) {
    cols.price = find(KW.price);
    cols.cat = find(KW.cat);
  }
  const costCands: number[] = [];
  for (let j = 0; j < H.length; j++)
    if (KW.cost.test(H[j]) && j !== cols.price && j !== cols.code && j !== cols.desc) costCands.push(j);
  const pref = costCands.find((j) => /(costo|neto|s\/?\s?iva|sin iva|contado)/i.test(H[j]));
  cols.cost = pref ?? costCands.find((j) => numRatio(j) > 0.6) ?? -1;
  if (forCatalog && cols.price === -1 && cols.cost !== -1 && costCands.length === 1 && !/costo|neto/i.test(H[cols.cost])) {
    cols.price = cols.cost;
    cols.cost = -1;
  }
  if (cols.desc === -1) {
    let bj = -1,
      bl = 0;
    for (let j = 0; j < ncol; j++) {
      if (j === cols.code) continue;
      const l = textLen(j);
      if (l > bl) {
        bl = l;
        bj = j;
      }
    }
    cols.desc = bj;
  }
  if (cols.cost === -1 && !forCatalog) {
    for (let j = ncol - 1; j >= 0; j--) {
      if (j === cols.code || j === cols.desc) continue;
      if (numRatio(j) > 0.7) {
        cols.cost = j;
        break;
      }
    }
  }
  return cols;
}

export function rowsToItems(rows: Rows, cols: SheetCols): RawItem[] {
  const out: RawItem[] = [];
  for (let i = cols.header + 1; i < rows.length; i++) {
    const r = rows[i];
    const desc = String(r[cols.desc] ?? "").trim();
    const cost = parseNum(r[cols.cost]);
    if (!desc || !/[a-záéíóúñ]/i.test(desc) || !(cost > 0)) continue;
    out.push({ code: cols.code >= 0 ? String(r[cols.code] ?? "").trim() : "", desc, cost });
  }
  return out;
}

/** Lectura sin IA: última cifra con forma de precio en cada renglón. */
export function heuristicLines(lines: string[]): RawItem[] {
  const out: RawItem[] = [];
  const priceRe = /\$?\s?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\$?\s?\d+(?:[.,]\d{1,2})?/g;
  for (const raw of lines) {
    const line = String(raw).replace(/\s*\|\s*/g, "   ").trim();
    if (!/[a-záéíóúñ]{3,}/i.test(line)) continue;
    const ms = [...line.matchAll(priceRe)];
    if (!ms.length) continue;
    const last = ms[ms.length - 1];
    const cost = parseNum(last[0]);
    if (!(cost > 0)) continue;
    let rest = (line.slice(0, last.index) + " " + line.slice(last.index! + last[0].length)).trim();
    let code = "";
    const cm = rest.match(/^([A-Z0-9][A-Z0-9\-/.]{1,11})\s+(?=\S)/i);
    if (cm && /\d/.test(cm[1])) {
      code = cm[1];
      rest = rest.slice(cm[0].length);
    }
    rest = rest.replace(/\s+\$?\s*$/, "").replace(/\s{2,}/g, " ").trim();
    if (rest.length < 3) continue;
    const pm = rest.match(/\b(?:caja|bulto|pack|display|cj|bto)\s*(?:x|de)?\s*(\d{1,3})\s*(?:u|un|unid|unidades)?\b/i);
    out.push({ code, desc: rest, cost, pack: pm ? Math.max(1, +pm[1]) : 1 });
  }
  return out;
}

/** Normaliza la salida de la IA: [["código","descripción",1234.56,unidades]] u objetos. */
export function cleanAiItems(res: unknown): RawItem[] {
  const arr: unknown[] = Array.isArray(res)
    ? res
    : res && typeof res === "object" && Array.isArray((res as { items?: unknown }).items)
      ? ((res as { items: unknown[] }).items)
      : [];
  const out: RawItem[] = [];
  for (const x of arr) {
    let code: unknown = "",
      desc: unknown = "",
      cost: unknown = NaN,
      pack: unknown = 1;
    if (Array.isArray(x)) {
      [code, desc, cost, pack] = x.length >= 3 ? x : ["", x[0], x[1], 1];
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      code = o.codigo ?? o.code ?? "";
      desc = o.descripcion ?? o.desc ?? o.nombre ?? "";
      cost = o.precio ?? o.costo ?? o.cost;
      pack = o.unidades ?? 1;
    }
    let pk = Math.round(+(pack as number));
    if (!(pk >= 1 && pk <= 1000)) pk = 1;
    const c = parseNum(cost);
    const d = String(desc ?? "").trim();
    const cd = String(code ?? "").trim();
    if (d && c > 0) out.push({ code: cd, desc: d, cost: c, pack: pk });
  }
  return out;
}

/** Limpia y quita duplicados (el último renglón con la misma clave gana). */
export function dedupeItems(items: RawItem[]): RawItem[] {
  const seen = new Map<string, RawItem>();
  for (const it of items) {
    if (!(it.cost > 0) || it.cost > 1e9) continue;
    seen.set(itemKey(it.code, it.desc), it);
  }
  return [...seen.values()];
}
