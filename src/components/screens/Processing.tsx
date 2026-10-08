"use client";
import { useState } from "react";
import { Icon, TopBar } from "../bits";
import { useApp } from "../ctx";
import { cancelProc } from "../actions";

export default function Processing() {
  const app = useApp();
  const p = app.ui.proc;
  if (!p) return null;
  const sup = app.data.suppliers.find((s) => s.id === p.supId);
  const back = p.error || p.needCols ? () => cancelProc(app) : undefined;

  if (p.needCols)
    return (
      <>
        <TopBar title="Leyendo la lista" onBack={back} />
        <main className="wrap">
          <ColPicker />
        </main>
      </>
    );

  if (p.error)
    return (
      <>
        <TopBar title="Leyendo la lista" onBack={back} />
        <main className="wrap">
          <div className="proc">
            <div className="errbox">{p.error}</div>
            <div className="btns" style={{ width: "100%" }}>
              <button className="btn" onClick={() => cancelProc(app)}>
                Probar de nuevo
              </button>
            </div>
          </div>
        </main>
      </>
    );

  const stepIx = p.pct < 0.8 ? 0 : p.pct < 0.98 ? 1 : 2;
  const steps = ["Leer productos y costos", "Buscarlos en tu catálogo", "Calcular precios de venta"];
  return (
    <>
      <TopBar title="Leyendo la lista" />
      <main className="wrap">
        <div className="proc">
          <div className="scan">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div>
            <h2>{sup?.name || ""}</h2>
            <p className="muted" aria-live="polite">
              {p.msg || "Preparando…"}
            </p>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={Math.round(p.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.round(p.pct * 100)}%` }} />
          </div>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s} className={i < stepIx ? "ok" : i === stepIx ? "on" : ""}>
                {i < stepIx ? <Icon n="check" s={18} /> : <span style={{ width: 18, textAlign: "center" }}>{i + 1}</span>}
                {s}
              </div>
            ))}
          </div>
          <p className="tiny">Puede tardar hasta un minuto por página. Podés dejar esta pantalla abierta.</p>
          <button className="btn sec" onClick={() => cancelProc(app)}>
            Cancelar
          </button>
        </div>
      </main>
    </>
  );
}

const colName = (j: number, hdr: unknown[]) => `Columna ${String.fromCharCode(65 + (j % 26))}${hdr[j] ? ": " + String(hdr[j]).slice(0, 24) : ""}`;

function ColPicker() {
  const app = useApp();
  const nc = app.ui.proc!.needCols!;
  const { rows, cols } = nc;
  const ncol = Math.max(...rows.slice(0, 30).map((r) => r.length));
  const hdr = cols.header >= 0 ? rows[cols.header] : [];
  const [desc, setDesc] = useState(Math.max(0, cols.desc));
  const [cost, setCost] = useState(Math.max(0, cols.cost));
  const [code, setCode] = useState(cols.code);
  const sel = (id: string, label: string, val: number, set: (n: number) => void, opt = false) => (
    <label className="f" htmlFor={id}>
      {label}
      <select className="inp" id={id} value={val} onChange={(e) => set(+e.target.value)}>
        {opt && <option value={-1}>No tiene</option>}
        {Array.from({ length: ncol }, (_, j) => (
          <option key={j} value={j}>
            {colName(j, hdr)}
          </option>
        ))}
      </select>
    </label>
  );
  const start = Math.max(0, cols.header);
  return (
    <>
      <h2>¿En qué columnas está cada dato?</h2>
      <p className="muted small">No pudimos reconocer la planilla sola. Elegí las columnas una vez y Remarcá las recuerda para este proveedor.</p>
      <div className="tbl-wrap">
        <table className="prev">
          <tbody>
            {rows.slice(start, start + 7).map((r, ri) => (
              <tr key={ri}>
                {Array.from({ length: ncol }, (_, j) => (
                  <td key={j}>{String(r[j] ?? "").slice(0, 30)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card stack">
        {sel("c-desc", "Descripción del producto", desc, setDesc)}
        {sel("c-cost", "Precio de costo", cost, setCost)}
        {sel("c-code", "Código (opcional)", code, setCode, true)}
      </div>
      <button
        className="btn block"
        onClick={() => {
          if (desc === cost) {
            app.toast("Elegí columnas distintas para descripción y costo.");
            return;
          }
          nc.resolve({ header: cols.header, desc, cost, code });
        }}
      >
        Continuar
      </button>
    </>
  );
}
