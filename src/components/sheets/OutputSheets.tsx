"use client";
import { useState } from "react";
import { costTxt, fmtDate, priceTxt } from "@/lib/core/format";
import { batchLine, lastUndoable } from "@/lib/core/review";
import { exportBatch, makeLabels, type LabelSize } from "@/lib/client/exporters";
import { Icon, Money, SheetHead } from "../bits";
import { useApp } from "../ctx";
import { undo } from "../actions";

export function BatchSheet({ id }: { id: string }) {
  const app = useApp();
  const { data, idx, st } = app;
  const b = data.history.find((h) => h.id === id);
  if (!b) return null;
  const can = lastUndoable(data)?.id === b.id;
  return (
    <>
      <SheetHead title={b.supName} />
      <div className="stack">
        <p className="muted small">
          {fmtDate(b.at)} · {batchLine(b)}
          {b.file ? " · " + b.file : ""}
          {b.undone && (
            <>
              {" · "}
              <b>deshecha</b>
            </>
          )}
        </p>
        {!b.undone && b.changes.length > 0 && (
          <div className="btns">
            <button className="btn sm tagb" onClick={() => app.openSheet({ type: "labels", ids: b.changes.map((c) => c.id).filter((x) => idx.byId.has(x)), size: "m" })}>
              <Icon n="tag" s={18} />
              Etiquetas
            </button>
            <button className="btn sm sec" onClick={() => void exportBatch(data, b)}>
              <Icon n="dl" s={18} />
              Excel
            </button>
            {can && (
              <button className="btn sm sec" onClick={() => undo(app, b.id)}>
                Deshacer
              </button>
            )}
          </div>
        )}
        {!b.undone && !can && <p className="tiny">Solo se puede deshacer la última lista aplicada.</p>}
        {b.changes.length ? (
          <div className="list">
            {b.changes.slice(0, 60).map((ch) => {
              const p = idx.byId.get(ch.id);
              return (
                <div className="li" key={ch.id}>
                  <span className="grow">
                    <span className="t">{p ? p.name : "Producto eliminado"}</span>
                    <span className="s">{ch.b ? `Costo ${costTxt(ch.b.cost)} → ${costTxt(ch.a.cost)}` : "Agregado al catálogo"}</span>
                  </span>
                  <span className="r">
                    {ch.b && <span className="old">$ {priceTxt(ch.b.price, st.round)}</span>}
                    <Money v={ch.a.price} />
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Esta lista no cambió precios.</p>
        )}
        {b.changes.length > 60 && <p className="tiny">Y {b.changes.length - 60} más.</p>}
      </div>
    </>
  );
}

const SIZES: [LabelSize, string, string][] = [
  ["s", "Chicas", "40 por hoja"],
  ["m", "Medianas", "24 por hoja"],
  ["g", "Grandes", "10 por hoja"],
];

export function LabelsSheet({ ids, initialSize }: { ids: string[]; initialSize: LabelSize }) {
  const app = useApp();
  const [size, setSize] = useState<LabelSize>(initialSize);
  const [withStore, setWithStore] = useState(true);
  const [busy, setBusy] = useState(false);
  const n = ids.length;
  return (
    <>
      <SheetHead title="Etiquetas de precio" />
      <div className="stack">
        <p className="muted">
          {n} {n === 1 ? "etiqueta" : "etiquetas"} en hojas A4, listas para imprimir y recortar.
        </p>
        <div className="seg">
          {SIZES.map(([v, l, d]) => (
            <button key={v} className={size === v ? "on" : ""} onClick={() => setSize(v)}>
              {l} · {d}
            </button>
          ))}
        </div>
        <label className="toggle small">
          <span>Mostrar el nombre del comercio</span>
          <input type="checkbox" checked={withStore} onChange={(e) => setWithStore(e.target.checked)} />
        </label>
        <button
          className="btn tagb block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await makeLabels(app.data, ids, size, withStore);
            } catch {
              app.toast("No se pudieron generar las etiquetas. Probá de nuevo.");
            }
            setBusy(false);
          }}
        >
          <Icon n="dl" s={20} />
          {busy ? "Generando…" : "Descargar PDF"}
        </button>
      </div>
    </>
  );
}
