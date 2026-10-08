/* Vinculación de renglones de la lista con el catálogo (especificación, sección 7). */
import type { Maps, Product, RawItem, ReviewItem, Supplier } from "./types";

const STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "sin", "en", "y", "p", "x", "por", "para", "a", "al", "e"]);

/** Normaliza texto y unidades: 1KG = 1 kg = 1000 g; 1.5LT = 1,5 l; 500GR = 500 g. */
export function norm(input: string | null | undefined): string {
  let s = String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  s = s
    .replace(/(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilogramos?|k)\b/g, "$1kg")
    .replace(/(\d+(?:\.\d+)?)\s*(grs?|gramos?|gms?|g)\b/g, "$1g")
    .replace(/(\d+(?:\.\d+)?)\s*(cc|ml|cm3|mililitros?)\b/g, "$1ml")
    .replace(/(\d+(?:\.\d+)?)\s*(lts?|litros?|l)\b/g, "$1l")
    .replace(/(\d+)\s*(unidades|unid|uds?|un|u)\b/g, "$1u");
  s = s
    .replace(/\b(\d+(?:\.\d+)?)g\b/g, (m, n: string) => (+n >= 1000 && +n % 1000 === 0 ? +n / 1000 + "kg" : m))
    .replace(/\b(\d+(?:\.\d+)?)ml\b/g, (m, n: string) => (+n >= 1000 && +n % 1000 === 0 ? +n / 1000 + "l" : m))
    .replace(/\b0\.(\d+)kg\b/g, (_m, n: string) => Math.round(parseFloat("0." + n) * 1000) + "g")
    .replace(/\b0\.(\d+)l\b/g, (_m, n: string) => Math.round(parseFloat("0." + n) * 1000) + "ml");
  s = s.replace(/[^a-z0-9.]+/g, " ").replace(/(^|[^0-9])\.|\.(?![0-9])/g, "$1 ");
  return s.replace(/\s+/g, " ").trim();
}

export interface Prepped {
  n: string;
  tok: Set<string>;
  tri: Set<string>;
  nums: Set<string>;
}

export function prep(text: string): Prepped {
  const n = norm(text);
  const toks = n.split(" ").filter((t) => t && !STOP.has(t));
  const tok = new Set(toks);
  const joined = " " + toks.join(" ") + " ";
  const tri = new Set<string>();
  for (let i = 0; i < joined.length - 2; i++) tri.add(joined.slice(i, i + 3));
  const nums = new Set(toks.filter((t) => /\d/.test(t)));
  return { n, tok, tri, nums };
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let i = 0;
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  for (const x of s) if (l.has(x)) i++;
  return (2 * i) / (a.size + b.size);
}

/** 55 % coincidencia de palabras + 45 % trigramas; ×0,45 si los tamaños no coinciden. */
export function sim(a: Prepped, b: Prepped): number {
  if (a.n && a.n === b.n) return 1;
  let s = 0.55 * dice(a.tok, b.tok) + 0.45 * dice(a.tri, b.tri);
  if (a.nums.size && b.nums.size) {
    let shared = false;
    for (const x of a.nums)
      if (b.nums.has(x)) {
        shared = true;
        break;
      }
    if (!shared) s *= 0.45;
  } else if (a.nums.size !== b.nums.size && (a.nums.size || b.nums.size)) s *= 0.9;
  return s;
}

export const normCode = (c: string | null | undefined) =>
  String(c || "")
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, "")
    .replace(/\s+/g, "");

export const itemKey = (code: string | null | undefined, desc: string) => (code ? "c:" + normCode(code) : "d:" + norm(desc));

/** Índice invertido por palabra, para no comparar contra todo el catálogo. */
export class CatalogIndex {
  readonly inv = new Map<string, string[]>();
  readonly pre = new Map<string, Prepped>();
  readonly byCode = new Map<string, Product>();
  readonly byId = new Map<string, Product>();
  readonly total: number;

  constructor(products: Product[]) {
    for (const p of products) {
      this.byId.set(p.id, p);
      const pr = prep(p.name);
      this.pre.set(p.id, pr);
      for (const t of pr.tok) {
        const arr = this.inv.get(t);
        if (arr) arr.push(p.id);
        else this.inv.set(t, [p.id]);
      }
      if (p.code) this.byCode.set(normCode(p.code), p);
    }
    this.total = products.length;
  }
}

export interface Candidate {
  id: string;
  score: number;
}

export function candidates(idx: CatalogIndex, desc: string, supId: string | null, n = 5): Candidate[] {
  const q = prep(desc);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const total = idx.total || 1;
  for (const t of q.tok) {
    const ids = idx.inv.get(t);
    if (!ids) continue;
    if (ids.length > Math.max(60, total * 0.35) && q.tok.size > 1) continue;
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = idx.byId.get(id);
      const pp = idx.pre.get(id)!;
      let sc = sim(q, pp);
      // una palabra distintiva del renglón (marca, variedad) que el producto no tiene: probablemente es otro producto
      if (sc < 1) {
        let miss = false;
        for (const w of q.tok) {
          if (/\d/.test(w) || pp.tok.has(w)) continue;
          const df = idx.inv.get(w)?.length || 0;
          if (df >= 1 && df <= 3) {
            sc *= 0.7;
            miss = true;
          }
        }
        // y además el producto tiene otra marca o variedad propia: casi seguro que no es
        if (miss)
          for (const w of pp.tok) {
            if (/\d/.test(w) || q.tok.has(w)) continue;
            const df = idx.inv.get(w)?.length || 0;
            if (df >= 1 && df <= 3) {
              sc *= 0.6;
              break;
            }
          }
      }
      if (p && supId && p.supplierId === supId) sc = Math.min(1, sc + 0.03);
      out.push({ id, score: sc });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, n);
}

export const THRESHOLDS = { exact: 0.97, auto: 0.84, autoGap: 0.06, doubt: 0.42 } as const;

/** Memoria del proveedor → código → parecido de nombre. */
export function matchItems(idx: CatalogIndex, raw: RawItem[], sup: Pick<Supplier, "id">, maps: Maps): ReviewItem[] {
  const memo = maps[sup.id] || {};
  return raw.map((r) => {
    const key = itemKey(r.code, r.desc);
    const it: ReviewItem = {
      key,
      code: r.code || "",
      desc: r.desc,
      listed: r.cost,
      productId: null,
      match: null,
      score: 0,
      cands: [],
      include: true,
      doubt: false,
      ignored: false,
      override: null,
      newCat: "",
      note: r.note || "",
      aiPack: r.pack && r.pack > 1 ? r.pack : 1,
      pack: null,
    };
    const m = memo[key];
    if (m === "-") {
      it.ignored = true;
      it.include = false;
      it.match = "ignorado";
      return it;
    }
    if (m && idx.byId.has(m)) {
      it.productId = m;
      it.match = "memoria";
      return it;
    }
    if (r.code) {
      const p = idx.byCode.get(normCode(r.code));
      if (p && (!p.supplierId || p.supplierId === sup.id)) {
        it.productId = p.id;
        it.match = "codigo";
        return it;
      }
    }
    const c = candidates(idx, r.desc, sup.id);
    it.cands = c.map((x) => x.id);
    const b = c[0],
      s2 = c[1]?.score ?? 0;
    if (b) {
      it.score = b.score;
      if (b.score >= THRESHOLDS.exact && s2 < THRESHOLDS.exact) {
        it.productId = b.id;
        it.match = "exacto";
      } else if (b.score >= THRESHOLDS.auto && s2 < b.score - THRESHOLDS.autoGap) {
        it.productId = b.id;
        it.match = "similar";
      } else if (b.score >= THRESHOLDS.doubt) {
        it.doubt = true;
        it.include = false;
        it.suggest = b.id;
      }
    }
    return it;
  });
}
