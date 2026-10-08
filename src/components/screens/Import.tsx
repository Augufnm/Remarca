"use client";
import { guessCols } from "@/lib/core/listread";
import { doImport, importItems } from "@/lib/core/review";
import { pickFile, readSheetRows, UserErr } from "@/lib/client/files";
import { TopBar } from "../bits";
import { useApp, type AppCtx } from "../ctx";

export async function importCatalog(app: AppCtx) {
  const [f] = await pickFile(".xlsx,.xls,.csv,.ods,text/csv");
  if (!f) return;
  try {
    const rows = await readSheetRows(f);
    if (!rows.length) throw new UserErr("La planilla está vacía.");
    const cols = guessCols(rows, true);
    if (cols.desc < 0) cols.desc = 0;
    app.ui.imp = { rows, cols, fileName: f.name, recalc: false, supId: "" };
    app.screen("import");
  } catch (e) {
    app.toast(e instanceof UserErr ? e.message : "No se pudo abrir ese archivo. Usá un Excel (.xlsx) o CSV.");
  }
}

type ColKey = "desc" | "code" | "cat" | "cost" | "price";

export default function ImportView() {
  const app = useApp();
  const { ui, data } = app;
  const m = ui.imp;
  if (!m) return null;
  const { rows, cols } = m;
  const ncol = Math.max(...rows.slice(0, 40).map((r) => r.length));
  const hdr = cols.header >= 0 ? rows[cols.header] : [];
  const L = (j: number) => `Columna ${String.fromCharCode(65 + (j % 26))}${hdr[j] ? ": " + String(hdr[j]).slice(0, 24) : ""}`;
  const { items, dupes } = importItems(data.products, rows, cols);
  const sel = (k: ColKey, label: string, opt = false) => (
    <label className="f" htmlFor={`imp-${k}`}>
      {label}
      <select
        className="inp"
        id={`imp-${k}`}
        value={cols[k]}
        onChange={(e) => {
          cols[k] = +e.target.value;
          app.render();
        }}
      >
        {opt && <option value={-1}>No tiene</option>}
        {Array.from({ length: ncol }, (_, j) => (
          <option key={j} value={j}>
            {L(j)}
          </option>
        ))}
      </select>
    </label>
  );
  const start = Math.max(0, cols.header);
  const back = () => {
    ui.imp = null;
    app.go("prices");
  };

  return (
    <>
      <TopBar title="Importar catálogo" onBack={back} />
      <main className="wrap">
        <p className="muted small">{m.fileName} · revisá qué columna tiene cada dato.</p>
        <div className="tbl-wrap">
          <table className="prev">
            <tbody>
              {rows.slice(start, start + 6).map((r, ri) => (
                <tr key={ri}>
                  {Array.from({ length: ncol }, (_, j) => {
                    const v = String(r[j] ?? "").slice(0, 30);
                    return ri === 0 && cols.header >= 0 ? <th key={j}>{v}</th> : <td key={j}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card stack">
          {sel("desc", "Producto")}
          {sel("code", "Código", true)}
          {sel("cat", "Categoría", true)}
          {sel("cost", "Costo", true)}
          {sel("price", "Precio de venta", true)}
          <label className="f" htmlFor="imp-sup">
            Proveedor
            <select
              className="inp"
              id="imp-sup"
              value={m.supId}
              onChange={(e) => {
                m.supId = e.target.value;
                app.render();
              }}
            >
              <option value="">Varios o ninguno</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {cols.cost >= 0 && (
            <label className="toggle small">
              <span>Recalcular precios de venta con mi margen</span>
              <input
                type="checkbox"
                checked={m.recalc}
                onChange={(e) => {
                  m.recalc = e.target.checked;
                  app.render();
                }}
              />
            </label>
          )}
        </div>
        {items.length ? (
          <p className="small">
            <b>{items.length}</b> productos listos para importar{dupes ? `, ${dupes} ya existen y se actualizan` : ""}.
          </p>
        ) : (
          <div className="warnbox">No encontramos productos con esas columnas. Probá eligiendo otras.</div>
        )}
        <button
          className="btn block"
          disabled={!items.length}
          onClick={() => {
            app.mutate((d) => doImport(d, items, m.supId || null, m.recalc));
            ui.imp = null;
            app.toast(`Importaste ${items.length} productos.`);
            app.go("prices");
          }}
        >
          Importar {items.length} productos
        </button>
      </main>
    </>
  );
}
