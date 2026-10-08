/* Reglas de cálculo de precios (especificación, sección 6). */
import { r2 } from "./format";
import type { Category, Product, Settings, Supplier } from "./types";

export const DEFAULT_SETTINGS = (): Settings => ({
  store: "",
  margin: 40,
  iva: 21,
  round: 10,
  roundMode: "up",
  ending: "",
  bigChange: 20,
  categories: [],
  createdAt: Date.now(),
  demo: false,
});

export const hasVal = (v: unknown): boolean => v !== null && v !== undefined && v !== "" && isFinite(+(v as number));

export function catOf(st: Settings, name: string | null | undefined): Category | undefined {
  return (st.categories || []).find((c) => c.name === name);
}

type MarginSource = Pick<Product, "category"> & { margin?: number | null };

/** Margen: el del producto, si no el de la categoría, si no el general. */
export function marginFor(st: Settings, p: MarginSource | null | undefined): number {
  if (p && hasVal(p.margin)) return +(p.margin as number);
  const c = p && catOf(st, p.category);
  if (c && hasVal(c.margin)) return +(c.margin as number);
  return +st.margin || 0;
}

export function ivaFor(st: Settings, cat: string | null | undefined): number {
  const c = catOf(st, cat);
  return c && hasVal(c.iva) ? +(c.iva as number) : +st.iva || 0;
}

export function roundPrice(st: Settings, v: number): number {
  const end = st.ending;
  if (end === "9") return Math.ceil((v + 1) / 10 - 1e-9) * 10 - 1;
  if (end === "90") return Math.ceil((v + 10) / 100 - 1e-9) * 100 - 10;
  if (end === "99") return Math.ceil((v + 1) / 100 - 1e-9) * 100 - 1;
  const step = +st.round || 0;
  if (!step) return r2(v);
  const q = v / step;
  return (st.roundMode === "near" ? Math.round(q) : Math.ceil(q - 1e-9)) * step;
}

export const priceFrom = (st: Settings, cost: number, p: MarginSource | null | undefined) =>
  roundPrice(st, cost * (1 + marginFor(st, p) / 100));

/** Cuántas unidades de venta trae el precio de lista (bulto x 12 → 12; kilo vendido por 100 g → 10). */
export function packOf(p: Pick<Product, "buy" | "sell"> | null | undefined): number {
  if (!p) return 1;
  const b = p.buy || { type: "u" };
  let n = b.type === "pack" ? +(b.n || 1) || 1 : 1;
  if (b.type === "kg" && p.sell === "100g") n = 10;
  return n > 0 ? n : 1;
}

const UNIT_TXT: Record<string, string> = { u: "", kg: "por kg", "100g": "x 100 g" };
export const unitTxt = (p: Pick<Product, "sell"> | null | undefined) => UNIT_TXT[p?.sell || "u"] || "";

/** Costo por unidad de venta: lista ÷ unidades → + IVA si la lista viene sin IVA → − bonificación. */
export function costFromList(
  st: Settings,
  listed: number,
  sup: Pick<Supplier, "ivaIncluded" | "discount">,
  cat: string | null | undefined,
  ivaOverride?: boolean | null,
  pack = 1,
): number {
  let c = +listed / (pack > 0 ? pack : 1);
  const inc = ivaOverride ?? !!sup.ivaIncluded;
  if (!inc) c *= 1 + ivaFor(st, cat) / 100;
  if (+sup.discount) c *= 1 - +sup.discount / 100;
  return r2(c);
}

export const isLoss = (p: Pick<Product, "cost" | "price">) => p.cost > 0 && p.price > 0 && p.price < p.cost - 0.005;
export const realMargin = (p: Pick<Product, "cost" | "price">) => (p.cost > 0 ? (p.price / p.cost - 1) * 100 : null);

export function pushHist(p: Product, ts: number) {
  p.hist = (p.hist || []).concat([[ts, p.cost, p.price]]).slice(-12);
}
