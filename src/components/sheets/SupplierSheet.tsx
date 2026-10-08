"use client";
import { useState } from "react";
import { newId, parseNum } from "@/lib/core/format";
import { SheetHead } from "../bits";
import { useApp } from "../ctx";
import { startNewList } from "../actions";

export default function SupplierSheet({ id }: { id: string | null }) {
  const app = useApp();
  const x = id ? app.data.suppliers.find((s) => s.id === id) : undefined;
  const [name, setName] = useState(x?.name || "");
  const [iva, setIva] = useState(!!x?.ivaIncluded);
  const [disc, setDisc] = useState(x?.discount ? String(x.discount).replace(".", ",") : "");
  const [hint, setHint] = useState(x?.aiHint || "");
  const [del, setDel] = useState(false);
  if (id && !x) return null;
  const learned = id ? Object.values(app.data.maps[id] || {}) : [];

  const save = () => {
    const n = name.trim();
    if (!n) {
      document.getElementById("s-name")?.focus();
      app.toast("Escribí el nombre del proveedor.");
      return;
    }
    const d = parseNum(disc);
    app.mutate((data) => {
      const s = id ? data.suppliers.find((y) => y.id === id)! : { id: newId(), name: n, ivaIncluded: false, discount: 0, aiHint: "", lastListAt: null, lists: 0 };
      s.name = n;
      s.ivaIncluded = iva;
      s.discount = d > 0 && d < 100 ? d : 0;
      s.aiHint = hint.trim();
      if (!id) data.suppliers.push(s);
    });
    app.openSheet(null);
    app.toast("Proveedor guardado.");
  };

  return (
    <>
      <SheetHead title={x ? x.name : "Nuevo proveedor"} />
      <div className="stack">
        <label className="f" htmlFor="s-name">
          Nombre
          <input className="inp" id="s-name" autoFocus={!id} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="toggle">
          <span>
            Los precios de su lista <b>incluyen IVA</b>
          </span>
          <input type="checkbox" checked={iva} onChange={(e) => setIva(e.target.checked)} />
        </label>
        <label className="f" htmlFor="s-disc">
          Bonificación o descuento que te hace
          <div className="inp-suf">
            <input className="inp num" id="s-disc" inputMode="decimal" placeholder="0" value={disc} onChange={(e) => setDisc(e.target.value)} />
            <b>%</b>
          </div>
        </label>
        <label className="f" htmlFor="s-hint">
          Indicaciones para leer su lista
          <textarea className="inp" id="s-hint" rows={2} placeholder="Ej.: usar la columna 'Precio x unidad', no la de bulto" value={hint} onChange={(e) => setHint(e.target.value)} />
        </label>
        {x && (
          <p className="tiny">
            {learned.filter((v) => v !== "-").length} productos vinculados y {learned.filter((v) => v === "-").length} marcados como &quot;no lo vendo&quot;. Remarcá los recuerda en cada lista.
          </p>
        )}
        <button className="btn block" onClick={save}>
          Guardar
        </button>
        {x && (
          <>
            <div className="btns">
              <button className="btn sm sec" onClick={() => startNewList(app, x.id)}>
                Cargar lista nueva
              </button>
              {learned.length > 0 && (
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    app.mutate((d) => {
                      delete d.maps[x.id];
                      const s = d.suppliers.find((y) => y.id === x.id);
                      if (s) delete s.cols;
                    });
                    app.toast("Vinculaciones olvidadas.");
                  }}
                >
                  Olvidar vinculaciones
                </button>
              )}
            </div>
            {del ? (
              <div className="errbox stack">
                <span>¿Eliminar a {x.name}? Sus productos quedan en tu catálogo.</span>
                <div className="btns">
                  <button
                    className="btn sm danger"
                    onClick={() => {
                      app.mutate((d) => {
                        d.suppliers = d.suppliers.filter((s) => s.id !== x.id);
                        delete d.maps[x.id];
                        for (const p of d.products) if (p.supplierId === x.id) p.supplierId = null;
                      });
                      app.openSheet(null);
                    }}
                  >
                    Eliminar
                  </button>
                  <button className="btn sm sec" onClick={() => setDel(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn sm ghost" onClick={() => setDel(true)}>
                Eliminar proveedor
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
