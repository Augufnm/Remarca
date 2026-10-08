"use client";
import { useState } from "react";
import { NF1, ago, costTxt, fmtDate, newId, parseNum, pctTxt, priceTxt, r2 } from "@/lib/core/format";
import { hasVal, marginFor, priceFrom, pushHist } from "@/lib/core/pricing";
import type { BuyType, Product, SellUnit } from "@/lib/core/types";
import { Icon, CatSelect, SheetHead } from "../bits";
import { useApp } from "../ctx";

const numTxt = (v: number | null | undefined) => (v ? String(v).replace(".", ",") : "");

export default function ProductSheet({ id }: { id: string | null }) {
  const app = useApp();
  const { st, idx } = app;
  const p0 = id ? idx.byId.get(id) : undefined;
  const [f, setF] = useState(() => ({
    name: p0?.name || "",
    code: p0?.code || "",
    category: p0?.category || "",
    supplierId: p0?.supplierId || "",
    buy: (p0?.buy?.type || "u") as BuyType,
    bn: p0?.buy?.n ? String(p0.buy.n) : "",
    sell: (p0?.sell || "u") as SellUnit,
    cost: numTxt(p0?.cost),
    margin: p0 && hasVal(p0.margin) ? String(p0.margin) : "",
    price: numTxt(p0?.price),
    lock: !!p0?.lock,
  }));
  const [manual, setManual] = useState(false);
  const [del, setDel] = useState(false);
  if (id && !p0) return null;

  const upd = (patch: Partial<typeof f>, recalcPrice = false) => {
    const n = { ...f, ...patch };
    if (recalcPrice && !manual) {
      const cost = parseNum(n.cost);
      if (cost > 0) n.price = String(priceFrom(st, cost, { category: n.category, margin: n.margin.trim() === "" ? null : parseNum(n.margin) })).replace(".", ",");
    }
    setF(n);
  };

  const cost = parseNum(f.cost),
    price = parseNum(f.price);
  let info: React.ReactNode = "Si cargás el costo, el precio se calcula con tu margen.";
  if (cost > 0 && price > 0)
    info =
      price < cost ? (
        <b style={{ color: "var(--bad)" }}>Con ese precio perdés {costTxt(cost - price)} por unidad.</b>
      ) : (
        `Ganancia por unidad: ${costTxt(price - cost)} (${NF1.format((price / cost - 1) * 100)} %)`
      );

  const save = () => {
    const name = f.name.trim();
    if (!name) {
      document.getElementById("p-name")?.focus();
      app.toast("Escribí el nombre del producto.");
      return;
    }
    const now = Date.now();
    app.mutate((d) => {
      const p: Product = id ? d.products.find((x) => x.id === id)! : { id: newId(), name, code: "", category: "", supplierId: null, cost: 0, price: 0, margin: null, updatedAt: now };
      const oldPrice = p.price,
        oldCost = p.cost;
      p.name = name;
      p.code = f.code.trim();
      p.category = f.category;
      p.supplierId = f.supplierId || null;
      const mg = f.margin.trim();
      p.margin = mg === "" || !isFinite(parseNum(mg)) ? null : parseNum(mg);
      const bn = Math.round(parseNum(f.bn));
      p.buy = f.buy === "pack" ? { type: "pack", n: bn > 1 ? bn : 1 } : { type: f.buy };
      p.sell = f.sell;
      p.lock = f.lock;
      p.cost = cost > 0 ? r2(cost) : 0;
      p.price = price > 0 ? r2(price) : p.cost ? priceFrom(d.settings!, p.cost, p) : 0;
      if (p.price !== oldPrice) p.priceAt = now;
      if (p.price !== oldPrice || p.cost !== oldCost) pushHist(p, now);
      p.updatedAt = now;
      if (!id) d.products.push(p);
    });
    app.openSheet(null);
    app.toast(id ? "Producto guardado." : "Producto agregado.");
  };

  const remove = () => {
    app.mutate((d) => {
      d.products = d.products.filter((p) => p.id !== id);
      for (const m of Object.values(d.maps)) for (const k in m) if (m[k] === id) delete m[k];
    });
    app.openSheet(null);
    app.toast("Producto eliminado.");
  };

  return (
    <>
      <SheetHead title={id ? "Producto" : "Nuevo producto"} />
      <div className="stack">
        <label className="f" htmlFor="p-name">
          Nombre
          <input className="inp" id="p-name" autoFocus={!id} value={f.name} placeholder="Ej.: Yerba Playadito 1 kg" onChange={(e) => upd({ name: e.target.value })} />
        </label>
        <div className="grid2">
          <label className="f" htmlFor="p-code">
            Código
            <input className="inp" id="p-code" value={f.code} onChange={(e) => upd({ code: e.target.value })} />
          </label>
          <label className="f" htmlFor="p-cat">
            Categoría
            <CatSelect id="p-cat" value={f.category} onChange={(v) => upd({ category: v }, true)} />
          </label>
        </div>
        <label className="f" htmlFor="p-sup">
          Proveedor
          <select className="inp" id="p-sup" value={f.supplierId} onChange={(e) => upd({ supplierId: e.target.value })}>
            <option value="">Ninguno</option>
            {app.data.suppliers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid2">
          <label className="f" htmlFor="p-buy">
            El proveedor lo cobra por
            <select className="inp" id="p-buy" value={f.buy} onChange={(e) => upd({ buy: e.target.value as BuyType })}>
              <option value="u">Unidad</option>
              <option value="pack">Bulto o caja</option>
              <option value="kg">Kilo</option>
            </select>
          </label>
          <label className="f" htmlFor="p-sell">
            Lo vendés por
            <select className="inp" id="p-sell" value={f.sell} onChange={(e) => upd({ sell: e.target.value as SellUnit })}>
              <option value="u">Unidad</option>
              <option value="kg">Kilo</option>
              <option value="100g">100 g</option>
            </select>
          </label>
        </div>
        {f.buy === "pack" && (
          <label className="f" htmlFor="p-bn">
            Unidades por bulto
            <input className="inp num" id="p-bn" inputMode="numeric" value={f.bn} placeholder="Ej.: 12" onChange={(e) => upd({ bn: e.target.value })} />
          </label>
        )}
        <p className="tiny">Se usa al leer las próximas listas: el precio del bulto se divide por las unidades, y el del kilo por 10 si vendés por 100 g.</p>
        <div className="grid2">
          <label className="f" htmlFor="p-cost">
            Costo {f.sell === "kg" ? "por kilo" : f.sell === "100g" ? "por 100 g" : "por unidad"}
            <div className="inp-pre">
              <input className="inp num" id="p-cost" inputMode="decimal" value={f.cost} onChange={(e) => upd({ cost: e.target.value }, true)} />
              <b>$</b>
            </div>
          </label>
          <label className="f" htmlFor="p-margin">
            Margen
            <div className="inp-suf">
              <input className="inp num" id="p-margin" inputMode="decimal" value={f.margin} placeholder={NF1.format(marginFor(st, { category: f.category }))} onChange={(e) => upd({ margin: e.target.value }, true)} />
              <b>%</b>
            </div>
          </label>
        </div>
        <label className="f" htmlFor="p-price">
          Precio de venta
          <div className="inp-pre">
            <input
              className="inp num"
              id="p-price"
              inputMode="decimal"
              value={f.price}
              onChange={(e) => {
                setManual(true);
                upd({ price: e.target.value });
              }}
            />
            <b>$</b>
          </div>
        </label>
        <p className="tiny">{info}</p>
        <label className="toggle small">
          <span>Precio fijo: las listas actualizan el costo pero no el precio de venta</span>
          <input type="checkbox" checked={f.lock} onChange={(e) => upd({ lock: e.target.checked })} />
        </label>
        {p0 && (
          <p className="tiny">
            Precio actualizado {ago(p0.priceAt)} · costo revisado {ago(p0.checkedAt || p0.updatedAt)}
          </p>
        )}
        {p0 && (p0.hist || []).length > 1 && <History p={p0} round={st.round} />}
        <button className="btn block" onClick={save}>
          Guardar
        </button>
        {p0 &&
          (del ? (
            <div className="errbox stack">
              <span>¿Eliminar {p0.name}?</span>
              <div className="btns">
                <button className="btn sm danger" onClick={remove}>
                  Eliminar
                </button>
                <button className="btn sm sec" onClick={() => setDel(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="btns">
              <button className="btn sm sec" onClick={() => app.openSheet({ type: "labels", ids: [p0.id], size: "g" })}>
                <Icon n="tag" s={18} />
                Etiqueta
              </button>
              <button className="btn sm ghost" onClick={() => setDel(true)}>
                Eliminar producto
              </button>
            </div>
          ))}
      </div>
    </>
  );
}

/** Historial de costos con gráfico. */
function History({ p, round }: { p: Product; round: number }) {
  const h = (p.hist || []).slice(-8);
  const max = Math.max(...h.map((x) => x[1]), 1),
    min = Math.min(...h.map((x) => x[1]));
  const W = 280,
    H = 56,
    pad = 6;
  const X = (i: number) => pad + (h.length === 1 ? 0 : (i * (W - 2 * pad)) / (h.length - 1));
  const Y = (v: number) => (max === min ? H / 2 : H - pad - ((v - min) / (max - min)) * (H - 2 * pad));
  const pts = h.map((x, i) => `${X(i).toFixed(1)},${Y(x[1]).toFixed(1)}`).join(" ");
  const first = h[0][1],
    last = h[h.length - 1][1];
  const rows = h.slice().reverse();
  return (
    <div className="card flat stack" style={{ padding: 12 }}>
      <div className="row">
        <b className="grow">Historial de costos</b>
        {first > 0 && <span className={`chip ${last >= first ? "up" : "down"}`}>{pctTxt((last / first - 1) * 100)}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Evolución del costo">
        <polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h.map((x, i) => (
          <circle key={i} cx={X(i).toFixed(1)} cy={Y(x[1]).toFixed(1)} r={i === h.length - 1 ? 4 : 2.5} fill={i === h.length - 1 ? "var(--tag)" : "var(--ink)"} stroke="var(--ink)" strokeWidth="1" />
        ))}
      </svg>
      <div>
        {rows.map((x, i) => {
          const prev = rows[i + 1];
          const d = prev && prev[1] > 0 ? (x[1] / prev[1] - 1) * 100 : null;
          return (
            <div className="kv" key={i}>
              <span>{fmtDate(x[0])}</span>
              <span className="num">
                costo {costTxt(x[1])}
                {d != null && Math.abs(d) >= 0.05 && (
                  <>
                    {" "}
                    <span className={`chip ${d > 0 ? "up" : "down"}`}>{pctTxt(d)}</span>
                  </>
                )}
              </span>
              <b>$ {priceTxt(x[2], round)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
