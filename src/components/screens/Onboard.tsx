"use client";
import { useState } from "react";
import { parseNum } from "@/lib/core/format";
import { DEFAULT_SETTINGS } from "@/lib/core/pricing";
import { Burst } from "../bits";
import { useApp } from "../ctx";
import { loadDemo } from "../actions";

const ROUNDS: [number, string][] = [
  [0, "Sin redondeo"],
  [1, "$ 1"],
  [10, "$ 10"],
  [50, "$ 50"],
  [100, "$ 100"],
];

export default function Onboard() {
  const app = useApp();
  const [store, setStore] = useState("");
  const [margin, setMargin] = useState("40");
  const [round, setRound] = useState(10);

  const start = () => {
    const m = parseNum(margin);
    if (!store.trim()) {
      document.getElementById("ob-store")?.focus();
      app.toast("Escribí el nombre del comercio.");
      return;
    }
    if (!(m >= 0) || m > 1000) {
      document.getElementById("ob-margin")?.focus();
      app.toast("Revisá el margen: tiene que ser un número, por ejemplo 40.");
      return;
    }
    app.mutate((d) => {
      d.settings = { ...DEFAULT_SETTINGS(), store: store.trim(), margin: m, round };
    });
    app.go("home");
  };

  return (
    <div className="onb">
      <header className="onb-hero">
        <span className="deco b1">
          <Burst fill="var(--yellow)" pts={16} inner={0.82} />
        </span>
        <span className="deco c1" />
        <span className="deco tag t1">
          <small>$</small>1.299
        </span>
        <div className="brand">
          <span className="logo">Remarcá</span>
        </div>
        <h2>Tus precios al día, en un toque.</h2>
        <p>Sacale una foto a la lista del proveedor. Remarcá lee los costos, aplica tu margen y te muestra solo lo que cambió.</p>
      </header>
      <div className="card stack">
        <label className="f" htmlFor="ob-store">
          Nombre del comercio
          <input className="inp" id="ob-store" autoComplete="organization" placeholder="Ej.: Almacén Don Tito" value={store} onChange={(e) => setStore(e.target.value)} />
        </label>
        <div className="f">
          <label className="f" htmlFor="ob-margin">
            Margen habitual de ganancia sobre el costo
          </label>
          <div className="inp-suf">
            <input className="inp num" id="ob-margin" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
            <b>%</b>
          </div>
          <div className="seg" style={{ marginTop: 8 }}>
            {[30, 35, 40, 50, 60].map((v) => (
              <button type="button" key={v} className={String(v) === margin ? "on" : ""} onClick={() => setMargin(String(v))}>
                {v} %
              </button>
            ))}
          </div>
        </div>
        <div className="f">
          <span>Redondear precios de venta</span>
          <div className="seg">
            {ROUNDS.map(([v, l]) => (
              <button type="button" key={v} className={round === v ? "on" : ""} onClick={() => setRound(v)}>
                {l}
              </button>
            ))}
          </div>
          <span className="tiny">Siempre hacia arriba. Lo podés cambiar después en Ajustes.</span>
        </div>
        <button className="btn pink block" onClick={start}>
          Empezar
        </button>
      </div>
      <div className="card flat stack">
        <p>
          <b>¿Querés verla funcionando primero?</b>
        </p>
        <p className="muted small">Cargamos un almacén de ejemplo con 27 productos y dos proveedores. Después lo borrás con un toque.</p>
        <button className="btn sec block" onClick={() => loadDemo(app)}>
          Probar con datos de ejemplo
        </button>
      </div>
    </div>
  );
}
