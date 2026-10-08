"use client";
/* Estado de la app con guardado local en IndexedDB (funciona sin conexión). */
import { get, set } from "idb-keyval";
import { CatalogIndex } from "@/lib/core/match";
import type { Data } from "@/lib/core/types";

const KEY = "remarca.v1";
const LEGACY_LS = "remarca.v1.";

export const emptyData = (): Data => ({ settings: null, suppliers: [], products: [], maps: {}, history: [] });

/** Acepta datos de una copia o del prototipo y completa lo que falte. */
export function sanitize(d: Partial<Data> | null | undefined): Data {
  const out = emptyData();
  if (!d || typeof d !== "object") return out;
  out.settings = d.settings && typeof d.settings === "object" ? { ...d.settings, categories: Array.isArray(d.settings.categories) ? d.settings.categories : [] } : null;
  out.suppliers = Array.isArray(d.suppliers) ? d.suppliers : [];
  out.products = Array.isArray(d.products) ? d.products : [];
  out.maps = d.maps && typeof d.maps === "object" ? d.maps : {};
  out.history = Array.isArray(d.history) ? d.history : [];
  return out;
}

type Listener = () => void;

class Store {
  data: Data = emptyData();
  version = 0;
  loaded = false;
  saveError = false;
  private listeners = new Set<Listener>();
  private idx: { v: number; idx: CatalogIndex } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;

  private emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  async load() {
    if (this.loaded) return;
    try {
      let d = await get<Data>(KEY);
      if (!d) d = readLegacy();
      this.data = sanitize(d);
    } catch {
      this.data = emptyData();
    }
    this.loaded = true;
    this.emit();
  }

  /** Cambia los datos y los guarda. */
  mutate(fn: (d: Data) => void) {
    fn(this.data);
    this.emit();
    this.schedule();
  }

  replace(d: Data) {
    this.data = sanitize(d);
    this.emit();
    this.schedule();
  }

  index(): CatalogIndex {
    if (!this.idx || this.idx.v !== this.version) this.idx = { v: this.version, idx: new CatalogIndex(this.data.products) };
    return this.idx.idx;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 300);
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      await set(KEY, this.data);
      if (this.saveError) {
        this.saveError = false;
        this.emit();
      }
    } catch {
      if (!this.saveError) {
        this.saveError = true;
        this.emit();
      }
    }
  }
}

/** Datos guardados por el prototipo en localStorage, si los hay. */
function readLegacy(): Data | undefined {
  try {
    const out: Record<string, unknown> = {};
    let any = false;
    for (const k of ["settings", "suppliers", "products", "maps", "history"]) {
      const raw = localStorage.getItem(LEGACY_LS + k);
      if (!raw) continue;
      const v = JSON.parse(raw);
      if (v && v.d !== undefined) {
        out[k] = v.d;
        any = true;
      }
    }
    return any ? (out as unknown as Data) : undefined;
  } catch {
    return undefined;
  }
}

export const store = new Store();

if (typeof window !== "undefined") {
  const flush = () => void store.flush();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
