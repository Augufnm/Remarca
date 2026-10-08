"use client";
import { createContext, useContext } from "react";
import type { Rows, GuessedCols } from "@/lib/core/listread";
import type { CatalogIndex } from "@/lib/core/match";
import type { Data, Review, Settings, SheetCols } from "@/lib/core/types";
import type { LabelSize } from "@/lib/client/exporters";

export type Tab = "home" | "prices" | "suppliers" | "settings";
export type Screen = null | "newlist" | "processing" | "review" | "done" | "import";

export type Sheet =
  | { type: "product"; id: string | null }
  | { type: "supplier"; id: string | null }
  | { type: "rvItem"; i: number }
  | { type: "pick"; i: number }
  | { type: "batch"; id: string }
  | { type: "labels"; ids: string[]; size: LabelSize };

export interface NewListState {
  supId: string | null;
  photos: { file: File; url: string }[];
  mode: "text" | null;
  text: string;
}

export interface ProcState {
  supId: string;
  msg: string;
  pct: number;
  ctl: AbortController;
  error: string | null;
  needCols: { rows: Rows; cols: SheetCols; resolve: (c: SheetCols) => void; reject: (e: unknown) => void } | null;
}

export interface ImportState {
  rows: Rows;
  cols: GuessedCols;
  fileName: string;
  recalc: boolean;
  supId: string;
}

export interface UI {
  tab: Tab;
  screen: Screen;
  sheet: Sheet | null;
  q: string;
  filter: string;
  plimit: number;
  select: boolean;
  selected: Set<string>;
  nl: NewListState | null;
  proc: ProcState | null;
  review: Review | null;
  imp: ImportState | null;
  doneId: string | null;
  wipe: boolean;
}

export const initialUI = (): UI => ({
  tab: "home",
  screen: null,
  sheet: null,
  q: "",
  filter: "all",
  plimit: 150,
  select: false,
  selected: new Set(),
  nl: null,
  proc: null,
  review: null,
  imp: null,
  doneId: null,
  wipe: false,
});

export interface Toast {
  id: number;
  msg: string;
  action?: { label: string; fn: () => void };
}

export interface AppCtx {
  data: Data;
  st: Settings;
  idx: CatalogIndex;
  ui: UI;
  /** vuelve a dibujar después de cambiar `ui` */
  render: () => void;
  go: (tab: Tab) => void;
  screen: (s: Screen) => void;
  openSheet: (s: Sheet | null) => void;
  toast: (msg: string, action?: Toast["action"]) => void;
  mutate: (fn: (d: Data) => void) => void;
  saveError: boolean;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fuera de <App>");
  return c;
}
