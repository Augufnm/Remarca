"use client";
import { useState } from "react";
import { NF1, costTxt, parseNum, pctTxt, priceTxt, tidyName } from "@/lib/core/format";
import { candidates, norm } from "@/lib/core/match";
import { hasVal, ivaFor, marginFor, priceFrom } from "@/lib/core/pricing";
import { calcItem } from "@/lib/core/review";
import { CatSelect, Icon, Money, SheetHead } from "../bits";
import { useApp } from "../ctx";
import { rvActions } from "../screens/Review";

/** Detalle de un renglón: desglose del costo, unidades, precio a mano, incluir o no. */
export function RvItemSheet({ i }: { i: number }) {
  const app = useApp();
  const { st, idx } = app;
  const R = app.ui.review!;
  const sup = app.data.suppliers.find((s) => s.id === R.supId)!;
  const it = R.items[i];
  const c = calcItem(st, idx, it, R, sup);
  const ivaInc = R.ivaOverride ?? !!sup.ivaIncluded;
  const [cat, setCat] = useState(it.newCat || R.newCat);
  const [pack, setPack] = useState(String(c.pack));
  const [price, setPrice] = useState(hasVal(it.override) ? String(it.override).replace(".", ",") : "");
  const [inc, setInc] = useState(it.include);
  const ccat = c.p ? c.p.category : cat;

  const save = () => {
    const v = price.trim();
    const ov = v === "" ? null : parseNum(v);
    it.override = ov != null && ov > 0 ? ov : null;
    it.include = inc;
    const pk = Math.round(parseNum(pack));
    it.pack = pk >= 1 ? pk : null;
    if (c.st === "new") it.newCat = cat;
    app.openSheet(null);
  };

  return (
    <>
      <SheetHead title={c.p ? c.p.name : tidyName(it.desc)} />
      <div className="stack">
        <div className="card flat" style={{ padding: 12 }}>
          <div className="kv">
            <span>En la lista</span>
            <b style={{ textAlign: "right" }}>{it.desc}</b>
          </div>
          {it.code && (
            <div className="kv">
              <span>Código</span>
              <b>{it.code}</b>
            </div>
          )}
          <div className="kv">
            <span>Precio de lista</span>
            <b>
              {costTxt(+it.listed)} {ivaInc ? "con IVA" : "sin IVA"}
            </b>
          </div>
          {c.pack > 1 && (
            <div className="kv">
              <span>÷ {c.pack} unidades de venta</span>
              <b>{costTxt(+it.listed / c.pack)}</b>
            </div>
          )}
          {!ivaInc && (
            <div className="kv">
              <span>+ IVA {NF1.format(ivaFor(st, ccat))} %</span>
              <b />
            </div>
          )}
          {+sup.discount > 0 && (
            <div className="kv">
              <span>− bonificación {NF1.format(sup.discount)} %</span>
              <b />
            </div>
          )}
          <div className="kv">
            <span>Costo para vos</span>
            <b>{costTxt(c.nc)}</b>
          </div>
          {c.oc != null && (
            <div className="kv">
              <span>Costo anterior</span>
              <b>
                {costTxt(c.oc)}
                {c.pct != null ? ` (${pctTxt(c.pct)})` : ""}
              </b>
            </div>
          )}
          {c.op != null && (
            <div className="kv">
              <span>Precio de venta actual</span>
              <b>$ {priceTxt(c.op, st.round)}</b>
            </div>
          )}
        </div>
        <label className="f" htmlFor="rv-pack">
          ¿Cuántas unidades de venta trae ese precio?
          <input className="inp num" id="rv-pack" inputMode="numeric" value={pack} onChange={(e) => setPack(e.target.value)} />
        </label>
        <p className="tiny">Poné 12 si el precio es por una caja de 12 y vos vendés por unidad. Remarcá lo recuerda para las próximas listas.</p>
        {c.lock && <div className="warnbox">Este producto tiene precio fijo: se actualiza el costo pero el precio de venta no cambia, salvo que escribas uno nuevo.</div>}
        {c.st === "new" && (
          <label className="f" htmlFor="rv-cat">
            Categoría
            <CatSelect id="rv-cat" value={cat} onChange={setCat} />
          </label>
        )}
        <label className="f" htmlFor="rv-price">
          Precio de venta nuevo
          <div className="inp-pre">
            <input className="inp num" id="rv-price" inputMode="decimal" placeholder={priceTxt(priceFrom(st, c.nc, c.p || { category: ccat }), st.round)} value={price} onChange={(e) => setPrice(e.target.value)} />
            <b>$</b>
          </div>
        </label>
        <p className="tiny">Vacío = se calcula con el margen ({NF1.format(marginFor(st, c.p || { category: ccat }))} %).</p>
        <label className="toggle">
          <span>{c.st === "new" ? "Agregar a mi catálogo" : "Aplicar este cambio"}</span>
          <input type="checkbox" checked={inc} onChange={(e) => setInc(e.target.checked)} />
        </label>
        <button className="btn block" onClick={save}>
          Listo
        </button>
        <div className="btns">
          <button className="btn sm sec" onClick={() => rvActions.pick(app, i)}>
            {c.p ? "Es otro producto" : "Ya lo tengo en el catálogo"}
          </button>
          {c.p ? (
            <button className="btn sm sec" onClick={() => rvActions.isNew(app, i)}>
              Es un producto nuevo
            </button>
          ) : (
            <button className="btn sm ghost" onClick={() => rvActions.ignore(app, i)}>
              No lo vendo
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** ¿Qué producto es? Busca en el catálogo. */
export function PickSheet({ i }: { i: number }) {
  const app = useApp();
  const { idx, data } = app;
  const R = app.ui.review!;
  const it = R.items[i];
  const [q, setQ] = useState("");
  let ids: string[];
  if (q.trim()) {
    const qs = norm(q).split(" ").filter(Boolean);
    ids = data.products
      .filter((p) => {
        const h = norm(p.name + " " + p.code);
        return qs.every((x) => h.includes(x));
      })
      .slice(0, 40)
      .map((p) => p.id);
  } else ids = it.cands.length ? it.cands : candidates(idx, it.desc, R.supId, 8).map((c) => c.id);

  return (
    <>
      <SheetHead title="¿Qué producto es?" />
      <div className="stack">
        <p className="small muted">
          En la lista: <b>{it.desc}</b>
        </p>
        <div className="inp-pre">
          <input className="inp" type="search" placeholder="Buscar en tu catálogo" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
          <b>
            <Icon n="search" s={18} />
          </b>
        </div>
        {!ids.length ? (
          <p className="muted small">No hay productos parecidos. Buscalo por nombre o código.</p>
        ) : (
          <div className="list">
            {ids.map((id) => {
              const p = idx.byId.get(id);
              if (!p) return null;
              return (
                <button
                  key={id}
                  className="li"
                  onClick={() => {
                    Object.assign(it, { productId: id, doubt: false, ignored: false, include: true, match: "manual" });
                    app.openSheet(null);
                  }}
                >
                  <span className="grow">
                    <span className="t">{p.name}</span>
                    <span className="s">{[p.category, p.code && "cód. " + p.code].filter(Boolean).join(" · ") || " "}</span>
                  </span>
                  <Money v={p.price} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
