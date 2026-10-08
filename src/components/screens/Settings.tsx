"use client";
import { useState } from "react";
import { NF1, parseNum } from "@/lib/core/format";
import { pendingRecalc } from "@/lib/core/review";
import type { Data, Ending, Settings as St } from "@/lib/core/types";
import { backup } from "@/lib/client/exporters";
import { pickFile } from "@/lib/client/files";
import { sanitize, store } from "@/lib/client/store";
import { Icon, TopBar } from "../bits";
import { useApp } from "../ctx";
import { recalc, wipeAll } from "../actions";

/** Campo que guarda al salir (como el "change" del prototipo). */
function Field({ id, value, onCommit, suffix, placeholder, numeric = true, label, width }: { id: string; value: string; onCommit: (v: string) => boolean | void; suffix?: string; placeholder?: string; numeric?: boolean; label?: string; width?: number }) {
  const [v, setV] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setV(value);
  }
  const input = (
    <input
      className={`inp${numeric ? " num" : ""}`}
      id={id}
      inputMode={numeric ? "decimal" : undefined}
      value={v}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v === value) return;
        if (onCommit(v) === false) setV(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
  return suffix ? (
    <div className="inp-suf" style={width ? { width } : undefined}>
      {input}
      <b>{suffix}</b>
    </div>
  ) : (
    input
  );
}

export default function SettingsView() {
  const app = useApp();
  const { st, data, ui } = app;
  const [newCat, setNewCat] = useState("");
  const pending = pendingRecalc(st, data.products);
  const set = (fn: (s: St) => void, msg = "Guardado.") => {
    app.mutate((d) => fn(d.settings!));
    if (msg) app.toast(msg);
  };
  const setNum = (k: "margin" | "iva" | "bigChange") => (v: string) => {
    const n = parseNum(v);
    if (!(n >= 0)) {
      app.toast("Escribí un número válido.");
      return false;
    }
    set((s) => {
      s[k] = n;
    });
  };
  const addCat = () => {
    const name = newCat.trim();
    if (!name) return;
    if (st.categories.some((c) => c.name === name)) {
      app.toast("Esa categoría ya existe.");
      return;
    }
    set((s) => s.categories.push({ name, margin: null, iva: null }), "");
    setNewCat("");
  };
  const restore = async () => {
    const [f] = await pickFile(".json,application/json");
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j?.app !== "remarca" || !j.data?.settings) throw 0;
      store.replace(sanitize(j.data as Data));
      app.toast("Copia restaurada.");
    } catch {
      app.toast("Ese archivo no es una copia de Remarcá.");
    }
  };

  return (
    <>
      <TopBar title="Ajustes" />
      <main className="wrap">
        <div className="card stack">
          <label className="f" htmlFor="s-store">
            Nombre del comercio
            <Field id="s-store" numeric={false} value={st.store} onCommit={(v) => set((s) => void (s.store = v.trim() || s.store))} />
          </label>
          <div className="grid2">
            <label className="f" htmlFor="s-margin">
              Margen general
              <Field id="s-margin" value={String(st.margin)} suffix="%" onCommit={setNum("margin")} />
            </label>
            <label className="f" htmlFor="s-iva">
              IVA general
              <Field id="s-iva" value={String(st.iva)} suffix="%" onCommit={setNum("iva")} />
            </label>
          </div>
          <p className="tiny">El IVA se suma al costo solo cuando la lista del proveedor viene sin IVA.</p>
          <div className="f">
            <span>Redondeo del precio de venta</span>
            <div className="seg">
              {(
                [
                  [0, "Sin redondeo"],
                  [1, "$ 1"],
                  [10, "$ 10"],
                  [50, "$ 50"],
                  [100, "$ 100"],
                ] as [number, string][]
              ).map(([v, l]) => (
                <button key={v} className={+st.round === v ? "on" : ""} onClick={() => set((s) => void (s.round = v), "")}>
                  {l}
                </button>
              ))}
            </div>
            <div className="seg" style={{ marginTop: 4 }}>
              <button className={st.roundMode !== "near" ? "on" : ""} onClick={() => set((s) => void (s.roundMode = "up"), "")}>
                Siempre hacia arriba
              </button>
              <button className={st.roundMode === "near" ? "on" : ""} onClick={() => set((s) => void (s.roundMode = "near"), "")}>
                Al más cercano
              </button>
            </div>
          </div>
          <div className="f">
            <span>Terminación del precio</span>
            <div className="seg">
              {(
                [
                  ["", "Normal"],
                  ["9", "Termina en 9 ($ 1.299)"],
                  ["90", "Termina en 90 ($ 1.290)"],
                  ["99", "Termina en 99 ($ 1.399)"],
                ] as [Ending, string][]
              ).map(([v, l]) => (
                <button key={v} className={(st.ending || "") === v ? "on" : ""} onClick={() => set((s) => void (s.ending = v), "")}>
                  {l}
                </button>
              ))}
            </div>
            {st.ending && <span className="tiny">Con terminación elegida, el redondeo de arriba no se usa.</span>}
          </div>
          <label className="f" htmlFor="s-big">
            Resaltar cambios mayores a
            <Field id="s-big" value={String(st.bigChange)} suffix="%" onCommit={setNum("bigChange")} />
          </label>
          {pending > 0 && (
            <div className="warnbox">
              <span>
                {pending} {pending === 1 ? "producto tiene" : "productos tienen"} un precio distinto al que da tu margen actual.
              </span>
              <button className="btn sm" onClick={() => recalc(app)}>
                Recalcular {pending} precios
              </button>
            </div>
          )}
        </div>

        <div className="sec-h">
          <h3>Márgenes por categoría</h3>
        </div>
        <div className="card stack">
          <p className="tiny">Si una categoría no tiene margen propio, usa el general ({NF1.format(st.margin)} %). Podés poner un IVA distinto, por ejemplo 10,5 %.</p>
          {st.categories.length ? (
            st.categories.map((c, i) => (
              <div className="row" style={{ flexWrap: "wrap" }} key={c.name}>
                <b className="grow" style={{ minWidth: 120 }}>
                  {c.name}
                </b>
                {(["margin", "iva"] as const).map((k) => (
                  <Field
                    key={k}
                    id={`cat-${i}-${k}`}
                    width={96}
                    suffix="%"
                    value={c[k] == null ? "" : String(c[k])}
                    placeholder={k === "margin" ? String(st.margin) : "IVA"}
                    label={`${k === "margin" ? "Margen" : "IVA"} de ${c.name}`}
                    onCommit={(v) =>
                      set((s) => {
                        const n = parseNum(v.trim());
                        s.categories[i][k] = v.trim() === "" || !(n >= 0) ? null : n;
                      })
                    }
                  />
                ))}
                <button
                  className="back"
                  style={{ width: 36, height: 36, border: 0, background: "var(--line2)", borderRadius: "50%", display: "grid", placeItems: "center" }}
                  aria-label={`Quitar ${c.name}`}
                  onClick={() => set((s) => void s.categories.splice(i, 1), `Quitaste ${c.name}. Sus productos usan el margen general.`)}
                >
                  <Icon n="x" s={18} />
                </button>
              </div>
            ))
          ) : (
            <p className="muted small">Todavía no hay categorías.</p>
          )}
          <div className="row">
            <input className="inp grow" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
            <button className="btn sm" onClick={addCat}>
              Agregar
            </button>
          </div>
        </div>

        <div className="sec-h">
          <h3>Tus datos</h3>
        </div>
        <div className="card stack">
          <p className="small muted">Tus datos se guardan en este dispositivo y funcionan sin conexión. Descargá una copia de vez en cuando para no perderlos.</p>
          <div className="btns">
            <button className="btn sm sec" onClick={() => void backup(data)}>
              <Icon n="dl" s={18} />
              Descargar copia
            </button>
            <button className="btn sm sec" onClick={() => void restore()}>
              Restaurar copia
            </button>
          </div>
          {ui.wipe ? (
            <div className="errbox stack">
              <b>¿Borrar todos los datos?</b>
              <span className="small">Se borran productos, proveedores, márgenes e historial. No se puede deshacer.</span>
              <div className="btns">
                <button
                  className="btn sm danger"
                  onClick={() => {
                    ui.wipe = false;
                    wipeAll(app);
                    app.toast("Se borraron todos los datos.");
                  }}
                >
                  Sí, borrar todo
                </button>
                <button
                  className="btn sm sec"
                  onClick={() => {
                    ui.wipe = false;
                    app.render();
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn sm ghost"
              onClick={() => {
                ui.wipe = true;
                app.render();
              }}
            >
              Borrar todos los datos
            </button>
          )}
        </div>
        <p className="tiny" style={{ textAlign: "center" }}>
          Remarcá · versión 0.1
        </p>
      </main>
    </>
  );
}
