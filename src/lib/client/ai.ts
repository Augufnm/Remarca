"use client";
/* El navegador nunca llama a la IA directo: pasa por las rutas /api/ai del servidor. */
import { cleanAiItems, heuristicLines } from "@/lib/core/listread";
import type { AiIva, AiUsage, ListMeta, RawItem, ReviewItem, SheetCols, Supplier } from "@/lib/core/types";
import type { CatalogIndex } from "@/lib/core/match";
import { blobToBase64, UserErr } from "./files";

export const AI = { checked: false, on: false, images: false };

export async function initAI() {
  try {
    const r = await fetch("/api/ai/status", { cache: "no-store" });
    const j = await r.json();
    AI.on = !!j.enabled;
    AI.images = !!j.images;
  } catch {
    AI.on = false;
    AI.images = false;
  }
  AI.checked = true;
}

export class AiErr extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function aiErrMsg(e: unknown): string {
  const c = (e as { code?: string })?.code;
  if (c === "not_configured") {
    AI.on = false;
    return "La lectura con IA no está disponible por ahora. Podés subir la lista en Excel o pegarla como texto.";
  }
  if (c === "rate_limited") return "Se alcanzó el límite de uso de la IA por ahora. Probá de nuevo en unos minutos.";
  if (c === "image_rejected") return "No se pudo leer la imagen. Probá con otra foto, más nítida y con buena luz.";
  if (c === "prompt_too_large") return "La lista es demasiado larga para leerla de una vez. Probá dividirla en partes.";
  if (c === "cancelled") return "cancelled";
  if (c === "refused" || c === "invalid_json") return "La IA no pudo interpretar esta parte de la lista.";
  return "Hubo un problema de conexión con la IA. Probá de nuevo.";
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === "AbortError" || (e as { code?: string })?.code === "cancelled";

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (isAbort(e)) throw new AiErr("cancelled");
    throw new AiErr("connection");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiErr(j.code || "connection");
  return j as T;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
export const zeroUsage = (): AiUsage => ({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
function addUsage(acc: AiUsage, u?: Usage) {
  if (!u) return;
  acc.inputTokens += u.inputTokens;
  acc.outputTokens += u.outputTokens;
  acc.costUsd += u.costUsd;
}

type Prog = (msg: string, pct: number) => void;
const supCtx = (sup: Supplier) => ({ name: sup.name, aiHint: sup.aiHint || undefined });

export interface ExtractResult {
  items: RawItem[];
  warn: string[];
  meta: ListMeta;
}

interface ExtractResp {
  iva: AiIva;
  columna: string;
  items: unknown[];
  usage: Usage;
}

/** Una foto por llamada. */
export async function aiExtractImages(blobs: Blob[], sup: Supplier, usage: AiUsage, signal: AbortSignal, onProg: Prog): Promise<ExtractResult> {
  const items: RawItem[] = [];
  const warn: string[] = [];
  let meta: ListMeta = {};
  for (let i = 0; i < blobs.length; i++) {
    onProg(`Leyendo ${blobs.length > 1 ? `página ${i + 1} de ${blobs.length}` : "la lista"} con IA`, 0.35 + 0.45 * (i / blobs.length));
    try {
      const data = await blobToBase64(blobs[i]);
      const res = await post<ExtractResp>("/api/ai/extract", { supplier: supCtx(sup), image: { data, mediaType: "image/jpeg" } }, signal);
      addUsage(usage, res.usage);
      items.push(...cleanAiItems(res.items));
      meta = { iva: res.iva || meta.iva, columna: res.columna || meta.columna };
    } catch (e) {
      const m = aiErrMsg(e);
      if (m === "cancelled") throw e;
      const c = (e as AiErr).code;
      if (c === "not_configured" || c === "rate_limited") throw new UserErr(m);
      warn.push(`${blobs.length > 1 ? `Página ${i + 1}: ` : ""}${m}`);
    }
  }
  return { items, warn, meta };
}

/** Texto en partes de unas 140 líneas. Si una parte falla, se lee sin IA y se avisa. */
export async function aiExtractText(lines: string[], sup: Supplier, usage: AiUsage, signal: AbortSignal, onProg: Prog): Promise<ExtractResult> {
  const items: RawItem[] = [];
  const warn: string[] = [];
  let meta: ListMeta = {};
  const clean = lines.map((l) => String(l).trim()).filter((l) => l && /\d/.test(l));
  const chunks: string[][] = [];
  let cur: string[] = [],
    size = 0;
  for (const l of clean) {
    cur.push(l);
    size += l.length;
    if (cur.length >= 140 || size > 9000) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
  }
  if (cur.length) chunks.push(cur);
  for (let i = 0; i < chunks.length; i++) {
    onProg(`Interpretando la lista con IA${chunks.length > 1 ? ` (parte ${i + 1} de ${chunks.length})` : ""}`, 0.35 + 0.45 * (i / chunks.length));
    try {
      const res = await post<ExtractResp>("/api/ai/extract", { supplier: supCtx(sup), text: chunks[i].join("\n"), part: { i: i + 1, n: chunks.length } }, signal);
      addUsage(usage, res.usage);
      items.push(...cleanAiItems(res.items));
      meta = { iva: res.iva || meta.iva, columna: res.columna || meta.columna };
    } catch (e) {
      const m = aiErrMsg(e);
      if (m === "cancelled") throw e;
      const c = (e as AiErr).code;
      if (c === "not_configured" || c === "rate_limited") {
        if (!items.length) {
          const h = heuristicLines(clean);
          if (h.length) {
            warn.push(m + " Leímos la lista sin IA; revisá los resultados.");
            return { items: h, warn, meta };
          }
        }
        throw new UserErr(m);
      }
      items.push(...heuristicLines(chunks[i]));
      warn.push(`${chunks.length > 1 ? `Parte ${i + 1}: ` : ""}${m} Se leyó sin IA; revisala.`);
    }
  }
  return { items, warn, meta };
}

interface ColsResp {
  fila_encabezado: number;
  codigo: number;
  descripcion: number;
  costo: number;
  iva: AiIva;
  columna: string;
  usage: Usage;
}

export async function aiDetectCols(rows: unknown[][], sup: Supplier, usage: AiUsage, signal: AbortSignal): Promise<{ cols: SheetCols; meta: ListMeta } | null> {
  const sample = rows.slice(0, 25).map((r) => r.slice(0, 60).map((c) => String(c ?? "").slice(0, 200)));
  const res = await post<ColsResp>("/api/ai/columns", { supplier: supCtx(sup), rows: sample }, signal);
  addUsage(usage, res.usage);
  const c: SheetCols = { header: Number.isInteger(res.fila_encabezado) ? res.fila_encabezado : -1, code: +res.codigo, desc: +res.descripcion, cost: +res.costo };
  if (!(c.desc >= 0) || !(c.cost >= 0)) return null;
  if (!(c.code >= 0)) c.code = -1;
  return { cols: c, meta: { iva: res.iva, columna: res.columna } };
}

/** Dudosos de a 25, con hasta 5 candidatos. Lo que no se resuelve queda para el usuario. */
export async function aiResolveDoubts(items: ReviewItem[], idx: CatalogIndex, usage: AiUsage, signal: AbortSignal, onProg: Prog) {
  const batches: ReviewItem[][] = [];
  for (let i = 0; i < items.length; i += 25) batches.push(items.slice(i, i + 25));
  let done = 0;
  for (const b of batches) {
    onProg(`Confirmando coincidencias dudosas con IA (${Math.min(done + b.length, items.length)} de ${items.length})`, 0.85 + 0.12 * (done / items.length));
    const payload = b.map((it, i) => ({ i, lista: it.desc.slice(0, 300), opciones: it.cands.slice(0, 5).map((id) => ({ id, n: (idx.byId.get(id)?.name || "").slice(0, 300) })) }));
    try {
      const res = await post<{ pairs: [number, string | null][]; usage: Usage }>("/api/ai/doubts", { items: payload }, signal);
      addUsage(usage, res.usage);
      for (const pair of res.pairs) {
        if (!Array.isArray(pair)) continue;
        const it = b[pair[0]];
        if (!it) continue;
        const id = pair[1];
        it.aiChecked = true;
        if (id && it.cands.includes(id)) {
          it.productId = id;
          it.doubt = false;
          it.include = true;
          it.match = "ia";
        } else if (id === null) {
          it.doubt = false;
          it.include = idx.total < 10;
          it.match = null;
          it.productId = null;
          it.aiNew = true;
        }
      }
    } catch (e) {
      if ((e as AiErr)?.code === "cancelled") throw e;
      break;
    }
    done += b.length;
  }
}
