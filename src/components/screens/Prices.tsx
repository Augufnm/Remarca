"use client";
import { NF0, costTxt, pctTxt } from "@/lib/core/format";
import { norm } from "@/lib/core/match";
import { isLoss, realMargin, unitTxt } from "@/lib/core/pricing";
import type { Product } from "@/lib/core/types";
import { exportPrices } from "@/lib/client/exporters";
import { Icon, Money, TopBar } from "../bits";
import { useApp, type AppCtx } from "../ctx";
import { importCatalog } from "./Import";

export function filteredProducts(app: AppCtx): Product[] {
  const { ui, data } = app;
  const qs = norm(ui.q).split(" ").filter(Boolean);
  let arr = data.products;
  if (ui.filter === "loss") arr = arr.filter(isLoss);
  else if (ui.filter.startsWith("cat:")) arr = arr.filter((p) => (p.category || "") === ui.filter.slice(4));
  else if (ui.filter.startsWith("sup:")) arr = arr.filter((p) => p.supplierId === ui.filter.slice(4));
  if (qs.length)
    arr = arr.filter((p) => {
      const h = norm(`${p.name} ${p.code} ${p.category}`);
      return qs.every((q) => h.includes(q));
    });
  return arr.slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function ProductRow({ p }: { p: Product }) {
  const app = useApp();
  const { ui, data } = app;
  const sup = data.suppliers.find((s) => s.id === p.supplierId);
  const m = realMargin(p);
  const sub = [p.category, sup?.name, p.code && `cód. ${p.code}`].filter(Boolean).join(" · ");
  const toggle = () => {
    if (ui.selected.has(p.id)) ui.selected.delete(p.id);
    else ui.selected.add(p.id);
    app.render();
  };
  const unit = [unitTxt(p), p.lock ? "precio fijo" : ""].filter(Boolean).join(" · ");
  return (
    <div className="li">
      {ui.select && <input type="checkbox" className="chk" checked={ui.selected.has(p.id)} onChange={toggle} aria-label={`Elegir ${p.name}`} />}
      <button className="grow rowbtn" onClick={() => (ui.select ? toggle() : app.openSheet({ type: "product", id: p.id }))}>
        <span className="grow">
          <span className="t">{p.name}</span>
          <span className="s">{sub || "Sin categoría"}</span>
        </span>
        <span className="r">
          <Money v={p.price} />
          {unit && <span className="tiny">{unit}</span>}
          <span className="tiny num">
            {p.cost ? `costo ${costTxt(p.cost)}` : "sin costo"}
            {m != null && (
              <>
                {" · "}
                {isLoss(p) ? <b style={{ color: "var(--bad)" }}>{pctTxt(m)}</b> : NF0.format(m) + " %"}
              </>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

export default function Prices() {
  const app = useApp();
  const { ui, data } = app;
  const losses = data.products.filter(isLoss).length;
  const cats = [...new Set(data.products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const arr = filteredProducts(app);
  const chip = (v: string, l: string) => (
    <button
      key={v}
      className={ui.filter === v ? "on" : ""}
      onClick={() => {
        ui.filter = ui.filter === v ? "all" : v;
        ui.plimit = 150;
        app.render();
      }}
    >
      {l}
    </button>
  );

  return (
    <>
      <TopBar title="Precios" />
      <main className="wrap" style={{ paddingTop: 0 }}>
        <div className="search">
          <div className="inp-pre">
            <input
              className="inp"
              id="q"
              type="search"
              placeholder="Buscar producto, código o categoría"
              value={ui.q}
              autoComplete="off"
              onChange={(e) => {
                ui.q = e.target.value;
                ui.plimit = 150;
                app.render();
              }}
            />
            <b>
              <Icon n="search" s={18} />
            </b>
          </div>
          <div className="chips seg">
            {chip("all", "Todos")}
            {losses > 0 && chip("loss", `A pérdida (${losses})`)}
            {cats.map((c) => chip("cat:" + c, c))}
            {data.suppliers.map((s) => chip("sup:" + s.id, s.name))}
          </div>
        </div>
        <div className="btns">
          {ui.select ? (
            <>
              <button
                className="btn sm sec"
                onClick={() => {
                  for (const p of arr) ui.selected.add(p.id);
                  app.render();
                }}
              >
                Elegir todos los de la lista
              </button>
              <button
                className="btn sm sec"
                onClick={() => {
                  ui.select = false;
                  ui.selected.clear();
                  app.render();
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button className="btn sm sec" onClick={() => app.openSheet({ type: "product", id: null })}>
                <Icon n="plus" s={18} />
                Producto
              </button>
              <button
                className="btn sm sec"
                onClick={() => {
                  ui.select = true;
                  ui.selected = new Set();
                  app.render();
                }}
              >
                <Icon n="tag" s={18} />
                Etiquetas
              </button>
              <button className="btn sm sec" onClick={() => void exportPrices(data, arr)}>
                <Icon n="dl" s={18} />
                Excel
              </button>
              <button className="btn sm sec" onClick={() => importCatalog(app)}>
                <Icon n="sheet" s={18} />
                Importar
              </button>
            </>
          )}
        </div>
        <div className="stack">
          {!data.products.length ? (
            <div className="empty">
              <p>Todavía no hay productos.</p>
              <div className="btns">
                <button className="btn sec" onClick={() => importCatalog(app)}>
                  Importar Excel
                </button>
                <button className="btn sec" onClick={() => app.openSheet({ type: "product", id: null })}>
                  Cargar a mano
                </button>
              </div>
            </div>
          ) : !arr.length ? (
            <div className="empty">
              <p>No hay productos que coincidan con la búsqueda.</p>
            </div>
          ) : (
            <>
              <p className="tiny" style={{ paddingInline: 2 }}>
                {NF0.format(arr.length)} {arr.length === 1 ? "producto" : "productos"}
              </p>
              <div className="list">
                {arr.slice(0, ui.plimit).map((p) => (
                  <ProductRow key={p.id} p={p} />
                ))}
                {arr.length > ui.plimit && (
                  <button
                    className="more"
                    onClick={() => {
                      ui.plimit += 150;
                      app.render();
                    }}
                  >
                    Mostrar {Math.min(150, arr.length - ui.plimit)} más
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      {ui.select && (
        <div className="applybar">
          <div>
            <span className="grow muted">{ui.selected.size} elegidos</span>
            <button className="btn tagb" disabled={!ui.selected.size} onClick={() => app.openSheet({ type: "labels", ids: [...ui.selected], size: "m" })}>
              <Icon n="tag" s={20} />
              Hacer etiquetas
            </button>
          </div>
        </div>
      )}
    </>
  );
}
