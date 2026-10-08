"use client";
/* Flujo de lectura: archivo → productos y costos → vinculación → revisión. */
import { dedupeItems, guessCols, heuristicLines, rowsToItems, type Rows } from "@/lib/core/listread";
import { matchItems } from "@/lib/core/match";
import type { Review, SheetCols, Supplier } from "@/lib/core/types";
import { AI, aiDetectCols, aiExtractImages, aiExtractText, aiResolveDoubts, zeroUsage, type ExtractResult } from "./ai";
import { readPdf, readSheetRows, shrinkImage, UserErr } from "./files";
import { store } from "./store";

export type PipelineInput =
  | { kind: "images"; photos: File[] }
  | { kind: "pdf"; file: File }
  | { kind: "sheet"; file: File }
  | { kind: "text"; text: string };

export interface PipelineOpts {
  supId: string;
  signal: AbortSignal;
  onProg: (msg: string, pct: number) => void;
  /** La planilla no se reconoció: pedir las columnas al usuario. */
  askCols: (rows: Rows, guess: SheetCols) => Promise<SheetCols>;
}

const SOURCE: Record<PipelineInput["kind"], string> = { images: "foto", pdf: "pdf", sheet: "excel", text: "texto" };
const NO_AI = "Se leyó sin IA. Revisá que los productos y precios sean correctos.";

export async function runPipeline(input: PipelineInput, o: PipelineOpts): Promise<Review | null> {
  const sup = (): Supplier => store.data.suppliers.find((s) => s.id === o.supId)!;
  const usage = zeroUsage();
  const { signal } = o;
  const prog = (m: string, p: number) => {
    if (!signal.aborted) o.onProg(m, p);
  };
  let res: ExtractResult = { items: [], warn: [], meta: {} };
  let fileName = "";

  if (input.kind === "images") {
    prog("Preparando las fotos", 0.1);
    const blobs: Blob[] = [];
    for (const f of input.photos) blobs.push(await shrinkImage(f));
    if (!AI.images) throw new UserErr("La lectura de fotos no está disponible por ahora. Subí la lista en PDF, Excel o como texto.");
    res = await aiExtractImages(blobs, sup(), usage, signal, prog);
    fileName = `${blobs.length} ${blobs.length === 1 ? "foto" : "fotos"}`;
  } else if (input.kind === "pdf") {
    fileName = input.file.name;
    prog("Abriendo el PDF", 0.08);
    const r = await readPdf(input.file, prog);
    if (r.images) {
      if (!AI.images) throw new UserErr("Este PDF es una imagen escaneada y para leerlo hace falta la IA, que no está disponible por ahora. Pedile al proveedor la lista en Excel o pegala como texto.");
      res = await aiExtractImages(r.images, sup(), usage, signal, prog);
    } else if (AI.on) res = await aiExtractText(r.lines, sup(), usage, signal, prog);
    else res = { items: heuristicLines(r.lines), warn: [NO_AI], meta: {} };
  } else if (input.kind === "sheet") {
    fileName = input.file.name;
    prog("Abriendo la planilla", 0.1);
    const rows = await readSheetRows(input.file);
    if (!rows.length) throw new UserErr("La planilla está vacía.");
    let cols: SheetCols | null = null;
    let meta = {};
    const saved = sup().cols;
    if (saved && rows[saved.header + 1]) cols = saved;
    if (!cols && AI.on) {
      prog("Reconociendo las columnas con IA", 0.3);
      try {
        const r = await aiDetectCols(rows, sup(), usage, signal);
        if (r) {
          cols = r.cols;
          meta = r.meta;
        }
      } catch (e) {
        if ((e as { code?: string })?.code === "cancelled") throw e;
      }
    }
    if (!cols) {
      const g = guessCols(rows, false);
      if (g.desc >= 0 && g.cost >= 0 && rowsToItems(rows, g).length >= Math.min(3, rows.length - 1)) cols = g;
    }
    let items = cols ? rowsToItems(rows, cols) : [];
    if (!items.length) {
      cols = await o.askCols(rows, cols || guessCols(rows, false));
      items = rowsToItems(rows, cols);
    }
    if (cols && cols !== saved) {
      const c = cols;
      store.mutate(() => {
        sup().cols = { header: c.header, code: c.code, desc: c.desc, cost: c.cost };
      });
    }
    res = { items, warn: [], meta };
  } else {
    fileName = "Texto pegado";
    const lines = String(input.text).split(/\r?\n/);
    if (AI.on) res = await aiExtractText(lines, sup(), usage, signal, prog);
    else res = { items: heuristicLines(lines), warn: [NO_AI], meta: {} };
  }
  if (signal.aborted) return null;

  const raw = dedupeItems(res.items);
  if (!raw.length) throw new UserErr(res.warn?.[0] || "No encontramos productos con precio en la lista. Probá con una foto más nítida o con el archivo original.");
  prog("Buscando cada producto en tu catálogo", 0.82);
  await new Promise((r) => setTimeout(r, 30));
  const idx = store.index();
  const items = matchItems(idx, raw, sup(), store.data.maps);
  const doubts = items.filter((i) => i.doubt);
  if (doubts.length && AI.on && doubts.length <= 200) {
    try {
      await aiResolveDoubts(doubts, idx, usage, signal, prog);
    } catch (e) {
      if ((e as { code?: string })?.code === "cancelled") return null;
    }
  }
  if (signal.aborted) return null;
  for (const it of items) if (!it.productId && !it.doubt && !it.ignored) it.include = idx.total < 10;
  if (res.meta?.columna && !sup().aiHint) {
    const col = res.meta.columna;
    store.mutate(() => {
      sup().aiHint = `Precio tomado de: ${col}`;
    });
  }
  prog("Calculando precios de venta", 0.99);
  return {
    supId: o.supId,
    items,
    source: SOURCE[input.kind],
    fileName,
    meta: res.meta || {},
    warn: res.warn || [],
    filter: null,
    newCat: "",
    ivaOverride: null,
    open: {},
    leave: false,
    ai: usage.inputTokens ? usage : undefined,
  };
}

