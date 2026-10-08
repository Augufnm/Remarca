"use client";
import { NF1, ago } from "@/lib/core/format";
import { Avatar, Icon, TopBar } from "../bits";
import { useApp } from "../ctx";

export default function Suppliers() {
  const app = useApp();
  const { data } = app;
  return (
    <>
      <TopBar title="Proveedores" />
      <main className="wrap">
        {!data.suppliers.length ? (
          <div className="empty">
            <p>Agregá a tus proveedores para que Remarcá aprenda cómo es la lista de cada uno.</p>
          </div>
        ) : (
          <div className="list">
            {data.suppliers.map((s) => {
              const n = data.products.filter((p) => p.supplierId === s.id).length;
              const learned = Object.keys(data.maps[s.id] || {}).length;
              return (
                <button key={s.id} className="li" onClick={() => app.openSheet({ type: "supplier", id: s.id })}>
                  <Avatar name={s.name} />
                  <span className="grow">
                    <span className="t">{s.name}</span>
                    <span className="s">
                      {s.ivaIncluded ? "Lista con IVA" : "Lista sin IVA"}
                      {+s.discount ? ` · bonificación ${NF1.format(s.discount)} %` : ""}
                    </span>
                    <span className="s">
                      {n} productos · {learned} renglones aprendidos · última lista {ago(s.lastListAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <button className="btn sec block" onClick={() => app.openSheet({ type: "supplier", id: null })}>
          <Icon n="plus" s={20} />
          Agregar proveedor
        </button>
      </main>
    </>
  );
}
