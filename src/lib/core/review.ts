/* Revisión de una lista, aplicar, deshacer, recalcular e importar catálogo. */
import { newId as defaultNewId, r2, tidyName, parseNum } from "./format";
import { CatalogIndex, norm, normCode } from "./match";
import { costFromList, hasVal, packOf, priceFrom, pushHist } from "./pricing";
import type { Batch, BatchChange, Data, Product, Review, ReviewItem, Settings, Supplier } from "./types";
import type { Rows, GuessedCols } from "./listread";

export type RowState = "" | "up" | "down" | "new" | "same" | "ignored" | "doubt";

export interface ItemCalc {
  st: RowState;
  /** costo nuevo por unidad de venta */
  nc: number;
  /** precio nuevo */
  np: number;
  oc: number | null;
  op: number | null;
  pct: number | null;
  big: boolean;
  p: Product | null;
  pack: number;
  lock: boolean;
  loss: boolean;
  /** ¿cambió la presentación? */
  odd: boolean;
}

export function calcItem(st: Settings, idx: CatalogIndex, it: ReviewItem, R: Review, sup: Supplier): ItemCalc {
  const o: ItemCalc = { st: "", nc: 0, np: 0, oc: null, op: null, pct: null, big: false, p: null, pack: 1, lock: false, loss: false, odd: false };
  if (it.ignored) o.st = "ignored";
  else if (it.doubt) o.st = "doubt";
  const p = it.productId ? idx.byId.get(it.productId) || null : null;
  o.p = p;
  const cat = p ? p.category : it.newCat || R.newCat || "";
  o.pack = it.pack ? +it.pack : p && p.buy ? packOf(p) : it.aiPack || 1;
  o.nc = costFromList(st, it.listed, sup, cat, R.ivaOverride, o.pack);
  if (o.st) {
    o.np = priceFrom(st, o.nc, p || { category: cat });
    return o;
  }
  if (!p) {
    o.st = "new";
    o.np = hasVal(it.override) ? +(it.override as number) : priceFrom(st, o.nc, { category: cat });
    o.loss = o.np < o.nc - 0.005;
    return o;
  }
  o.oc = p.cost;
  o.op = p.price;
  o.lock = !!p.lock;
  o.np = hasVal(it.override) ? +(it.override as number) : p.lock ? p.price : priceFrom(st, o.nc, p);
  o.loss = o.np < o.nc - 0.005;
  const dc = o.nc - o.oc,
    dp = o.np - o.op;
  if (Math.abs(dc) < 0.005 && Math.abs(dp) < 0.005) o.st = "same";
  else o.st = dc > 0.004 || (Math.abs(dc) <= 0.004 && dp > 0) ? "up" : "down";
  o.pct = o.oc > 0 ? (o.nc / o.oc - 1) * 100 : null;
  o.big = o.pct != null && Math.abs(o.pct) >= (+st.bigChange || 20);
  o.odd = o.pct != null && (o.pct > 150 || o.pct < -60);
  if (o.loss) o.big = true;
  return o;
}

export interface ReviewSummary {
  C: ItemCalc[];
  n: Record<Exclude<RowState, "">, number>;
  apply: number;
}

export function reviewCalc(st: Settings, idx: CatalogIndex, R: Review, sup: Supplier): ReviewSummary {
  const C = R.items.map((it) => calcItem(st, idx, it, R, sup));
  const n = { up: 0, down: 0, new: 0, same: 0, ignored: 0, doubt: 0 };
  C.forEach((c) => {
    if (c.st) n[c.st]++;
  });
  let apply = 0;
  R.items.forEach((it, i) => {
    const c = C[i];
    if ((c.st === "up" || c.st === "down" || c.st === "new") && it.include) apply++;
  });
  return { C, n, apply };
}

/** "Subieron 14, bajaron 1 y hay 2 nuevos." */
export function summarySentence(n: { up: number; down: number; new: number }): string {
  const parts: string[] = [];
  if (n.up) parts.push(`subieron ${n.up}`);
  if (n.down) parts.push(`bajaron ${n.down}`);
  if (n.new) parts.push(`hay ${n.new} ${n.new === 1 ? "nuevo" : "nuevos"}`);
  let s = parts.length ? parts.join(", ").replace(/, ([^,]*)$/, " y $1") : "no hay cambios de precio";
  s = s[0].toUpperCase() + s.slice(1) + ".";
  return s;
}

export function batchLine(b: Batch): string {
  if (b.source === "recalculo") return "Recálculo con márgenes";
  const c = b.counts || { up: 0, down: 0, new: 0 };
  const p: string[] = [];
  if (c.up) p.push(`subieron ${c.up}`);
  if (c.down) p.push(`bajaron ${c.down}`);
  if (c.new) p.push(`${c.new} nuevos`);
  return p.join(", ") || "sin cambios";
}

const HISTORY_MAX = 25;

/** Aplica la revisión al catálogo y devuelve el lote (deshacible). */
export function applyReview(data: Data, R: Review, now = Date.now(), newId = defaultNewId): Batch {
  const st = data.settings!;
  const sup = data.suppliers.find((s) => s.id === R.supId)!;
  const idx = new CatalogIndex(data.products);
  const { C } = reviewCalc(st, idx, R, sup);
  const maps = data.maps[sup.id] || (data.maps[sup.id] = {});
  const changes: BatchChange[] = [];
  const counts = { up: 0, down: 0, new: 0 };
  const checked: { id: string; checkedAt: number | null }[] = [];
  R.items.forEach((it, i) => {
    const c = C[i];
    if (c.st === "ignored" || c.st === "doubt") return;
    if (c.st === "new") {
      if (it.include) {
        const cat = it.newCat || R.newCat || "";
        const p: Product = {
          id: newId(),
          code: it.code || "",
          name: tidyName(it.desc),
          category: cat,
          supplierId: sup.id,
          cost: c.nc,
          price: c.np,
          margin: null,
          updatedAt: now,
          priceAt: now,
          buy: c.pack > 1 ? { type: "pack", n: c.pack } : { type: "u" },
          sell: "u",
        };
        pushHist(p, now);
        data.products.push(p);
        maps[it.key] = p.id;
        changes.push({ id: p.id, b: null, a: { cost: p.cost, price: p.price } });
        counts.new++;
      } else maps[it.key] = "-";
      return;
    }
    maps[it.key] = it.productId!;
    const p = c.p!;
    if (c.st === "same") {
      checked.push({ id: p.id, checkedAt: p.checkedAt ?? null });
      p.checkedAt = now;
      return;
    }
    if (!it.include) return;
    const b = {
      cost: p.cost,
      price: p.price,
      updatedAt: p.updatedAt || null,
      priceAt: p.priceAt || null,
      supplierId: p.supplierId || null,
      checkedAt: p.checkedAt || null,
      buy: p.buy ? { ...p.buy } : null,
      hist: (p.hist || []).slice(),
    };
    p.cost = c.nc;
    p.updatedAt = now;
    p.checkedAt = now;
    p.supplierId = sup.id;
    if (c.pack !== packOf(p) && !(p.buy?.type === "kg")) p.buy = c.pack > 1 ? { type: "pack", n: c.pack } : { type: "u" };
    if (Math.abs(p.price - c.np) > 0.004) {
      p.price = c.np;
      p.priceAt = now;
    }
    pushHist(p, now);
    changes.push({ id: p.id, b, a: { cost: p.cost, price: p.price } });
    if (c.st === "up" || c.st === "down") counts[c.st]++;
  });
  if (R.ivaOverride != null && R.ivaSave) sup.ivaIncluded = !!R.ivaOverride;
  const prevListAt = sup.lastListAt || null;
  sup.lastListAt = now;
  sup.lists = (sup.lists || 0) + 1;
  const batch: Batch = { id: newId(), at: now, supId: sup.id, supName: sup.name, source: R.source, file: R.fileName, counts, changes, undone: false, prevListAt, checked, ai: R.ai };
  data.history.unshift(batch);
  if (data.history.length > HISTORY_MAX) data.history.length = HISTORY_MAX;
  return batch;
}

export const lastUndoable = (data: Data) => data.history.find((h) => !h.undone);

/** Solo se puede deshacer el último lote aplicado. Deja todo exactamente como estaba. */
export function undoBatch(data: Data, id: string): boolean {
  const b = data.history.find((h) => h.id === id);
  if (!b || b.undone || lastUndoable(data)?.id !== id) return false;
  const del = new Set<string>();
  const byId = new Map(data.products.map((p) => [p.id, p]));
  for (const ch of b.changes.slice().reverse()) {
    const p = byId.get(ch.id);
    if (!p) continue;
    if (ch.b === null) del.add(p.id);
    else {
      const { buy, ...rest } = ch.b;
      Object.assign(p, rest);
      if (buy !== undefined) {
        if (buy === null) delete p.buy;
        else p.buy = buy;
      }
    }
  }
  for (const c of b.checked || []) {
    const p = byId.get(c.id);
    if (p) p.checkedAt = c.checkedAt;
  }
  if (del.size) data.products = data.products.filter((p) => !del.has(p.id));
  if (b.source !== "recalculo") {
    const sup = data.suppliers.find((s) => s.id === b.supId);
    if (sup) {
      sup.lastListAt = b.prevListAt ?? null;
      sup.lists = Math.max(0, (sup.lists || 1) - 1);
    }
  }
  b.undone = true;
  return true;
}

export function pendingRecalc(st: Settings, products: Product[]): number {
  return products.filter((p) => p.cost > 0 && !p.lock && Math.abs(priceFrom(st, p.cost, p) - p.price) > 0.004).length;
}

/** Recalcula los precios con los márgenes actuales (saltea los de precio fijo). Deshacible. */
export function recalcAll(data: Data, now = Date.now(), newId = defaultNewId): Batch | null {
  const st = data.settings!;
  const changes: BatchChange[] = [];
  for (const p of data.products) {
    if (!(p.cost > 0) || p.lock) continue;
    const np = priceFrom(st, p.cost, p);
    if (Math.abs(np - p.price) > 0.004) {
      changes.push({
        id: p.id,
        b: { cost: p.cost, price: p.price, updatedAt: p.updatedAt || null, priceAt: p.priceAt || null, supplierId: p.supplierId || null, checkedAt: p.checkedAt || null, hist: (p.hist || []).slice() },
        a: { cost: p.cost, price: np },
      });
      p.price = np;
      p.priceAt = now;
      pushHist(p, now);
    }
  }
  if (!changes.length) return null;
  const up = changes.filter((c) => c.a.price > c.b!.price).length;
  const b: Batch = { id: newId(), at: now, supId: null, supName: "Recálculo con márgenes", source: "recalculo", file: "", counts: { up, down: changes.length - up, new: 0 }, changes, undone: false };
  data.history.unshift(b);
  if (data.history.length > HISTORY_MAX) data.history.length = HISTORY_MAX;
  return b;
}

/* ---------- importar catálogo ---------- */

export interface ImportItem {
  name: string;
  code: string;
  category: string;
  cost: number;
  price: number;
  existing: Product | null;
}

export function importItems(products: Product[], rows: Rows, cols: GuessedCols): { items: ImportItem[]; dupes: number } {
  const out: ImportItem[] = [];
  let dupes = 0;
  const byCode = new Map(products.filter((p) => p.code).map((p) => [normCode(p.code), p]));
  const byName = new Map(products.map((p) => [norm(p.name), p]));
  for (let i = cols.header + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[cols.desc] ?? "").trim();
    if (!name || !/[a-záéíóúñ]/i.test(name)) continue;
    const it: ImportItem = {
      name,
      code: cols.code >= 0 ? String(r[cols.code] ?? "").trim() : "",
      category: cols.cat >= 0 ? String(r[cols.cat] ?? "").trim() : "",
      cost: cols.cost >= 0 ? parseNum(r[cols.cost]) : NaN,
      price: cols.price >= 0 ? parseNum(r[cols.price]) : NaN,
      existing: null,
    };
    if (!(it.cost > 0) && !(it.price > 0)) continue;
    it.existing = (it.code && byCode.get(normCode(it.code))) || byName.get(norm(name)) || null;
    if (it.existing) dupes++;
    out.push(it);
  }
  return { items: out, dupes };
}

export function doImport(data: Data, items: ImportItem[], supId: string | null, recalc: boolean, now = Date.now(), newId = defaultNewId): number {
  const st = data.settings!;
  const cats = new Set((st.categories || []).map((c) => c.name));
  for (const it of items) {
    if (it.category && !cats.has(it.category)) {
      st.categories.push({ name: it.category, margin: null, iva: null });
      cats.add(it.category);
    }
    const p: Product = it.existing || { id: newId(), name: it.name, code: "", category: "", supplierId: supId || null, cost: 0, price: 0, margin: null, updatedAt: now, priceAt: now };
    p.name = it.name;
    if (it.code) p.code = it.code;
    if (it.category) p.category = it.category;
    if (supId) p.supplierId = supId;
    if (it.cost > 0) p.cost = r2(it.cost);
    if (it.price > 0 && !recalc) p.price = r2(it.price);
    else if (p.cost > 0) p.price = priceFrom(st, p.cost, p);
    p.updatedAt = now;
    pushHist(p, now);
    if (!it.existing) data.products.push(p);
  }
  return items.length;
}
