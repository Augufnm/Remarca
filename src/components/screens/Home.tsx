"use client";
import { NF0, ago, fmtDate } from "@/lib/core/format";
import { isLoss } from "@/lib/core/pricing";
import { batchLine } from "@/lib/core/review";
import { Avatar, Burst, Icon, SyncBadge } from "../bits";
import { useApp } from "../ctx";
import { demoList, startNewList, wipeAll } from "../actions";
import { importCatalog } from "./Import";

export default function Home() {
  const app = useApp();
  const { data, st } = app;
  const now = Date.now();
  const losses = data.products.filter(isLoss).length;
  const stale = data.suppliers.filter((s) => s.lastListAt && now - s.lastListAt > 30 * 86400000);
  const lastAt = data.products.reduce((m, p) => Math.max(m, p.priceAt || 0), 0);
  const hora = new Date().getHours();
  const saludo = hora < 13 ? "Buen día" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <>
      <header className="hero">
        <span className="deco d1">
          <Burst fill="var(--yellow)" pts={16} inner={0.82} />
        </span>
        <span className="deco d2" />
        <div className="row">
          <span className="grow hello">{saludo}</span>
          <SyncBadge />
        </div>
        <h1>{st.store || "Mi comercio"}</h1>
      </header>
      <main className="wrap">
        <button className="hero-cta" onClick={() => startNewList(app)}>
          <span className="ic">
            <Icon n="camera" s={30} />
          </span>
          <span className="grow">
            <b>Nueva lista</b>
            <span className="sub">Foto, PDF o Excel del proveedor</span>
          </span>
          <span className="arrow">
            <Icon n="up" s={20} style={{ transform: "rotate(90deg)" }} />
          </span>
        </button>
        {st.demo && (
          <div className="demo-note">
            <Icon n="alert" s={20} />
            <span className="grow">Estás viendo datos de ejemplo.</span>
            <button className="btn sm sec" onClick={() => wipeAll(app)}>
              Borrar ejemplo
            </button>
          </div>
        )}
        {st.demo && !data.history.length && (
          <div className="card stack">
            <p>
              <b>Probá el flujo completo</b>
            </p>
            <p className="muted small">Llegó la lista nueva de Distribuidora del Sur. Leela, revisá los cambios y aplicalos.</p>
            <button className="btn tagb block" onClick={() => demoList(app)}>
              Usar la lista de ejemplo
            </button>
          </div>
        )}
        {!data.products.length && (
          <div className="card stack">
            <h2>Cargá tu catálogo</h2>
            <p className="muted small">Podés importar el Excel que ya usás, cargar productos a mano o crearlo directamente desde la primera lista de un proveedor.</p>
            <div className="btns">
              <button className="btn sec" onClick={() => importCatalog(app)}>
                <Icon n="sheet" s={20} />
                Importar Excel
              </button>
              <button className="btn sec" onClick={() => app.openSheet({ type: "product", id: null })}>
                <Icon n="plus" s={20} />
                Cargar a mano
              </button>
            </div>
            <button className="btn tagb block" onClick={() => startNewList(app)}>
              Crear desde la primera lista
            </button>
          </div>
        )}
        {losses > 0 && (
          <button
            className="alert bad"
            onClick={() => {
              app.ui.filter = "loss";
              app.ui.q = "";
              app.go("prices");
            }}
          >
            <Icon n="alert" />
            <span className="grow">
              <b>
                {losses} {losses === 1 ? "producto se vende" : "productos se venden"} por debajo del costo
              </b>
              <span>Tocá para verlos y corregirlos.</span>
            </span>
          </button>
        )}
        {stale.slice(0, 2).map((s) => (
          <button key={s.id} className="alert warn" onClick={() => startNewList(app, s.id)}>
            <Icon n="clock" />
            <span className="grow">
              <b>
                {s.name}: última lista {ago(s.lastListAt)}
              </b>
              <span>Si te mandó una nueva, cargala para no perder margen.</span>
            </span>
          </button>
        ))}
        <div className="stats">
          <div className="stat">
            <b>{NF0.format(data.products.length)}</b>
            <span>productos</span>
          </div>
          <div className="stat">
            <b>{data.suppliers.length}</b>
            <span>proveedores</span>
          </div>
          <div className="stat">
            <b style={{ fontSize: 17, lineHeight: 1.5 }}>{lastAt ? ago(lastAt) : "—"}</b>
            <span>última actualización</span>
          </div>
        </div>
        {data.history.length > 0 && (
          <>
            <div className="sec-h">
              <h3>Últimas listas</h3>
            </div>
            <div className="list">
              {data.history.slice(0, 8).map((b) => (
                <button key={b.id} className="li" onClick={() => app.openSheet({ type: "batch", id: b.id })}>
                  <Avatar name={b.supName} />
                  <span className="grow">
                    <span className="t">{b.supName}</span>
                    <span className="s">
                      {fmtDate(b.at)} · {batchLine(b)}
                    </span>
                  </span>
                  <span className="r">{b.undone ? <span className="chip mute">Deshecha</span> : <span className="chip mute">{b.changes.length} cambios</span>}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
