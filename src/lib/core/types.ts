/* Tipos del dominio. Mantienen la forma de los datos del prototipo para que las
   copias de seguridad sean compatibles entre ambos. */

export type Ending = "" | "9" | "90" | "99";
export type RoundMode = "up" | "near";
export type SellUnit = "u" | "kg" | "100g";
export type BuyType = "u" | "pack" | "kg";

export interface Category {
  name: string;
  margin: number | null;
  iva: number | null;
}

export interface Settings {
  store: string;
  margin: number;
  iva: number;
  round: number;
  roundMode: RoundMode;
  ending: Ending;
  bigChange: number;
  categories: Category[];
  createdAt: number;
  demo: boolean;
}

export interface Buy {
  type: BuyType;
  n?: number;
}

/** [fecha, costo, precio] */
export type HistEntry = [number, number, number];

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  supplierId: string | null;
  /** costo por UNIDAD DE VENTA, con IVA y bonificación aplicados */
  cost: number;
  price: number;
  margin: number | null;
  lock?: boolean;
  buy?: Buy;
  sell?: SellUnit;
  updatedAt?: number | null;
  priceAt?: number | null;
  checkedAt?: number | null;
  hist?: HistEntry[];
}

export interface SheetCols {
  header: number;
  code: number;
  desc: number;
  cost: number;
  cat?: number;
  price?: number;
}

export interface Supplier {
  id: string;
  name: string;
  ivaIncluded: boolean;
  discount: number;
  aiHint: string;
  lastListAt: number | null;
  lists: number;
  cols?: SheetCols;
}

/** supplierId → itemKey → productId, o "-" si es "no lo vendo" */
export type Maps = Record<string, Record<string, string>>;

export interface ProductSnapshot {
  cost: number;
  price: number;
  updatedAt?: number | null;
  priceAt?: number | null;
  supplierId?: string | null;
  checkedAt?: number | null;
  buy?: Buy | null;
  hist?: HistEntry[];
}

export interface BatchChange {
  id: string;
  /** null = el producto se creó con esta lista */
  b: ProductSnapshot | null;
  a: { cost: number; price: number };
}

export interface Batch {
  id: string;
  at: number;
  supId: string | null;
  supName: string;
  source: string;
  file: string;
  counts: { up: number; down: number; new: number };
  changes: BatchChange[];
  undone: boolean;
  prevListAt?: number | null;
  /** productos revisados sin cambio: fecha de revisión anterior, para deshacer */
  checked?: { id: string; checkedAt: number | null }[];
  ai?: AiUsage;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface Data {
  settings: Settings | null;
  suppliers: Supplier[];
  products: Product[];
  maps: Maps;
  history: Batch[];
}

/** Renglón leído de la lista del proveedor */
export interface RawItem {
  code: string;
  desc: string;
  cost: number;
  pack?: number;
  note?: string;
}

export type MatchType = "memoria" | "codigo" | "exacto" | "similar" | "ia" | "manual" | "ignorado" | null;

export interface ReviewItem {
  key: string;
  code: string;
  desc: string;
  listed: number;
  productId: string | null;
  match: MatchType;
  score: number;
  cands: string[];
  include: boolean;
  doubt: boolean;
  ignored: boolean;
  override: number | null;
  newCat: string;
  note: string;
  aiPack: number;
  pack: number | null;
  suggest?: string;
  aiChecked?: boolean;
  aiNew?: boolean;
}

export type AiIva = "incluido" | "no_incluido" | "no_dice";

export interface ListMeta {
  iva?: AiIva | null;
  columna?: string;
}

export interface Review {
  supId: string;
  items: ReviewItem[];
  source: string;
  fileName: string;
  meta: ListMeta;
  warn: string[];
  filter: "up" | "down" | "new" | null;
  newCat: string;
  ivaOverride: boolean | null;
  ivaSave?: boolean;
  open: Record<string, boolean>;
  leave: boolean;
  ai?: AiUsage;
}
