"use client";
/* Acciones que cruzan pantallas: nueva lista, procesar, aplicar, deshacer. */
import { applyReview, lastUndoable, recalcAll, undoBatch } from "@/lib/core/review";
import { DEMO_LIST, DEMO_SUPPLIER_ID, seedDemo } from "@/lib/core/demo";
import { aiErrMsg } from "@/lib/client/ai";
import { confetti } from "@/lib/client/exporters";
import { UserErr } from "@/lib/client/files";
import { runPipeline, type PipelineInput } from "@/lib/client/pipeline";
import { emptyData, store } from "@/lib/client/store";
import type { AppCtx } from "./ctx";

export function startNewList(app: AppCtx, supId?: string) {
  const sups = app.data.suppliers;
  app.ui.nl = { supId: supId ?? (sups.length === 1 ? sups[0].id : null), photos: [], mode: null, text: "" };
  app.screen("newlist");
}

export async function readList(app: AppCtx, input: PipelineInput) {
  const { ui } = app;
  const supId = ui.nl?.supId;
  if (!supId) return;
  const ctl = new AbortController();
  ui.proc = { supId, msg: "Preparando…", pct: 0.03, ctl, error: null, needCols: null };
  app.screen("processing");
  try {
    const review = await runPipeline(input, {
      supId,
      signal: ctl.signal,
      onProg: (msg, pct) => {
        if (!ui.proc || ui.proc.ctl !== ctl) return;
        ui.proc.msg = msg;
        ui.proc.pct = Math.max(ui.proc.pct || 0, pct);
        app.render();
      },
      askCols: (rows, cols) =>
        new Promise((resolve, reject) => {
          if (!ui.proc) return reject(Object.assign(new Error("cancelled"), { code: "cancelled" }));
          ui.proc.needCols = {
            rows,
            cols,
            resolve: (c) => {
              if (ui.proc) ui.proc.needCols = null;
              app.render();
              resolve(c);
            },
            reject,
          };
          app.render();
        }),
    });
    if (!review || ctl.signal.aborted || ui.proc?.ctl !== ctl) return;
    ui.review = review;
    ui.proc = null;
    app.screen("review");
  } catch (e) {
    if (ctl.signal.aborted || (e as { code?: string })?.code === "cancelled") return;
    console.error(e);
    if (ui.proc && ui.proc.ctl === ctl) {
      ui.proc.error =
        e instanceof UserErr ? e.message : (e as { code?: string })?.code ? aiErrMsg(e) : "No se pudo leer el archivo. Verificá que sea una lista de precios y probá de nuevo.";
      ui.proc.needCols = null;
      app.render();
    }
  }
}

export function cancelProc(app: AppCtx) {
  const p = app.ui.proc;
  if (p?.needCols) p.needCols.reject(Object.assign(new Error("cancelled"), { code: "cancelled" }));
  p?.ctl.abort();
  app.ui.proc = null;
  app.screen("newlist");
}

export function applyList(app: AppCtx) {
  const R = app.ui.review;
  if (!R) return;
  let id = "";
  let n = 0;
  app.mutate((d) => {
    const b = applyReview(d, R);
    id = b.id;
    n = b.changes.length;
  });
  app.ui.review = null;
  app.ui.nl = null;
  app.ui.doneId = id;
  app.screen("done");
  if (n) confetti();
}

export function undo(app: AppCtx, id: string) {
  if (lastUndoable(app.data)?.id !== id) {
    app.toast("Solo se puede deshacer la última lista aplicada.");
    return;
  }
  app.mutate((d) => undoBatch(d, id));
  app.ui.sheet = null;
  app.render();
  app.toast("Listo, los precios volvieron a como estaban.");
}

export function recalc(app: AppCtx) {
  let id: string | null = null;
  app.mutate((d) => {
    id = recalcAll(d)?.id ?? null;
  });
  if (id) {
    app.ui.doneId = id;
    app.screen("done");
  }
}

export function loadDemo(app: AppCtx) {
  store.replace(seedDemo());
  app.ui.tab = "home";
  app.ui.screen = null;
  app.render();
  app.toast("Cargamos un almacén de ejemplo.");
}

export function wipeAll(app: AppCtx) {
  store.replace(emptyData());
  app.ui.screen = null;
  app.ui.sheet = null;
  app.ui.tab = "home";
  app.render();
}

export function demoList(app: AppCtx) {
  if (!app.data.suppliers.some((s) => s.id === DEMO_SUPPLIER_ID)) return;
  app.ui.nl = { supId: DEMO_SUPPLIER_ID, photos: [], mode: "text", text: DEMO_LIST };
  void readList(app, { kind: "text", text: DEMO_LIST });
}
