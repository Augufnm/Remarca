"use client";
import { useApp } from "../ctx";
import ProductSheet from "./ProductSheet";
import SupplierSheet from "./SupplierSheet";
import { PickSheet, RvItemSheet } from "./ReviewSheets";
import { BatchSheet, LabelsSheet } from "./OutputSheets";

export default function SheetHost() {
  const app = useApp();
  const s = app.ui.sheet;
  if (!s) return null;
  let body: React.ReactNode = null;
  if (s.type === "product") body = <ProductSheet key={s.id || "new"} id={s.id} />;
  else if (s.type === "supplier") body = <SupplierSheet key={s.id || "new"} id={s.id} />;
  else if (s.type === "rvItem") body = <RvItemSheet key={s.i} i={s.i} />;
  else if (s.type === "pick") body = <PickSheet key={s.i} i={s.i} />;
  else if (s.type === "batch") body = <BatchSheet id={s.id} />;
  else if (s.type === "labels") body = <LabelsSheet ids={s.ids} initialSize={s.size} />;
  return (
    <div className="sheet">
      <div className="bg" onClick={() => app.openSheet(null)} />
      <div className="pane" role="dialog" aria-modal="true">
        <div className="grab" />
        {body}
      </div>
    </div>
  );
}
