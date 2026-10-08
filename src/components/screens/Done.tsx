"use client";
import { batchLine } from "@/lib/core/review";
import { exportBatch } from "@/lib/client/exporters";
import { Burst, Icon, TopBar } from "../bits";
import { useApp } from "../ctx";
import { undo } from "../actions";

export default function Done() {
  const app = useApp();
  const { data, ui, idx } = app;
  const b = data.history.find((h) => h.id === ui.doneId);
  const home = () => app.go("home");
  if (!b) return null;
  const ids = b.changes.map((c) => c.id).filter((id) => idx.byId.has(id));
  if (b.undone)
    return (
      <>
        <TopBar title="Listo" onBack={home} />
        <main className="wrap">
          <div className="done-hero">
            <div className="ok">
              <Burst fill="var(--sky)" pts={16} inner={0.84} />
              <Icon n="back" />
            </div>
            <h2>Deshiciste la lista</h2>
            <p className="muted">Los precios volvieron a como estaban.</p>
          </div>
          <button className="btn block" onClick={home}>
            Volver al inicio
          </button>
        </main>
      </>
    );
  return (
    <>
      <TopBar title="Listo" onBack={home} />
      <main className="wrap">
        <div className="done-hero">
          <div className="ok">
            <Burst fill="var(--lime)" pts={16} inner={0.84} />
            <Icon n="check" />
          </div>
          <h2>{b.changes.length ? `Actualizaste ${b.changes.length} ${b.changes.length === 1 ? "precio" : "precios"}` : "Tus precios ya estaban al día"}</h2>
          <p className="muted">
            {b.supName} · {batchLine(b)}
          </p>
        </div>
        {ids.length > 0 && (
          <>
            <button className="btn tagb block" onClick={() => app.openSheet({ type: "labels", ids, size: "m" })}>
              <Icon n="tag" s={20} />
              Etiquetas de lo que cambió ({ids.length})
            </button>
            <button className="btn sec block" onClick={() => void exportBatch(data, b)}>
              <Icon n="dl" s={20} />
              Exportar cambios a Excel
            </button>
          </>
        )}
        <div className="btns">
          <button className="btn sec" onClick={() => undo(app, b.id)}>
            Deshacer
          </button>
          <button className="btn sec" onClick={home}>
            Volver al inicio
          </button>
        </div>
      </main>
    </>
  );
}
