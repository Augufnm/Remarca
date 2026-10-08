"use client";
import { useState } from "react";
import { NF1, ago, newId } from "@/lib/core/format";
import { AI } from "@/lib/client/ai";
import { pickFile } from "@/lib/client/files";
import { Avatar, Icon, TopBar } from "../bits";
import { useApp, type AppCtx } from "../ctx";
import { readList } from "../actions";

function addPhotos(app: AppCtx, files: File[]) {
  for (const f of files || []) if (f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name)) app.ui.nl!.photos.push({ file: f, url: URL.createObjectURL(f) });
  app.render();
}

export default function NewList() {
  const app = useApp();
  const { ui, data } = app;
  const nl = ui.nl!;
  const sup = nl.supId ? data.suppliers.find((s) => s.id === nl.supId) : undefined;
  const [name, setName] = useState("");
  const [iva, setIva] = useState(false);
  const [text, setText] = useState(nl.text || "");

  const back = () => {
    if (nl.supId && (nl.photos.length || nl.mode)) {
      nl.photos = [];
      nl.mode = null;
      app.render();
      return;
    }
    ui.nl = null;
    app.go("home");
  };

  const newSup = () => {
    const n = name.trim();
    if (!n) {
      document.getElementById("nl-name")?.focus();
      app.toast("Escribí el nombre del proveedor.");
      return;
    }
    const id = newId();
    app.mutate((d) => d.suppliers.push({ id, name: n, ivaIncluded: iva, discount: 0, lastListAt: null, lists: 0, aiHint: "" }));
    nl.supId = id;
    app.render();
  };

  if (!sup) {
    const sorted = data.suppliers.slice().sort((a, b) => (b.lastListAt || 0) - (a.lastListAt || 0));
    return (
      <>
        <TopBar title="Nueva lista" onBack={back} />
        <main className="wrap">
          <h2>¿De qué proveedor es la lista?</h2>
          <div className="sup-pick">
            {sorted.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  nl.supId = s.id;
                  app.render();
                }}
              >
                <Avatar name={s.name} />
                <span className="grow">
                  <b>{s.name}</b>
                  <br />
                  <span className="tiny">
                    Última lista {ago(s.lastListAt)} · {s.ivaIncluded ? "con IVA" : "sin IVA"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="card stack">
            <b>{data.suppliers.length ? "Otro proveedor" : "Agregá el proveedor"}</b>
            <input className="inp" id="nl-name" placeholder="Nombre del proveedor" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newSup()} />
            <label className="toggle small">
              <span>
                Los precios de su lista <b>incluyen IVA</b>
              </span>
              <input type="checkbox" checked={iva} onChange={(e) => setIva(e.target.checked)} />
            </label>
            <button className="btn block" onClick={newSup}>
              Continuar
            </button>
          </div>
        </main>
      </>
    );
  }

  const head = (
    <div className="row">
      <Avatar name={sup.name} />
      <span className="grow">
        <b>{sup.name}</b>
        <br />
        <span className="tiny">
          {sup.ivaIncluded ? "Precios con IVA" : "Precios sin IVA"}
          {+sup.discount ? ` · bonificación ${NF1.format(sup.discount)} %` : ""}
        </span>
      </span>
      <button
        className="btn sm sec"
        onClick={() => {
          nl.supId = null;
          nl.photos = [];
          app.render();
        }}
      >
        Cambiar
      </button>
    </div>
  );

  const takePhoto = async () => addPhotos(app, await pickFile("image/*", { capture: true }));
  const gallery = async () => addPhotos(app, await pickFile("image/*", { multiple: true }));

  if (nl.photos.length)
    return (
      <>
        <TopBar title="Nueva lista" onBack={back} />
        <main className="wrap">
          {head}
          <h2>Páginas de la lista</h2>
          <div className="thumbs">
            {nl.photos.map((p, i) => (
              <figure key={p.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Página ${i + 1}`} />
                <button
                  aria-label={`Quitar página ${i + 1}`}
                  onClick={() => {
                    const [x] = nl.photos.splice(i, 1);
                    URL.revokeObjectURL(x.url);
                    app.render();
                  }}
                >
                  ×
                </button>
              </figure>
            ))}
          </div>
          <div className="btns">
            <button className="btn sec" onClick={takePhoto}>
              <Icon n="camera" s={20} />
              Otra página
            </button>
            <button className="btn tagb" onClick={() => void readList(app, { kind: "images", photos: nl.photos.map((p) => p.file) })}>
              Leer lista
            </button>
          </div>
        </main>
      </>
    );

  if (nl.mode === "text")
    return (
      <>
        <TopBar title="Nueva lista" onBack={back} />
        <main className="wrap">
          {head}
          <label className="f" htmlFor="nl-text">
            Pegá la lista (por ejemplo, el mensaje de WhatsApp del proveedor)
            <textarea className="inp" id="nl-text" rows={12} autoFocus placeholder={"YERBA PLAYADITO 1KG  3.950\nAZUCAR LEDESMA 1KG  990\n…"} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="btns">
            <button
              className="btn sec"
              onClick={() => {
                nl.mode = null;
                app.render();
              }}
            >
              Volver
            </button>
            <button
              className="btn tagb"
              onClick={() => {
                nl.text = text;
                if (!text.trim()) {
                  app.toast("Pegá el texto de la lista.");
                  return;
                }
                void readList(app, { kind: "text", text });
              }}
            >
              Leer lista
            </button>
          </div>
        </main>
      </>
    );

  const imgOk = AI.images;
  return (
    <>
      <TopBar title="Nueva lista" onBack={back} />
      <main className="wrap">
        {head}
        <div className="src-grid">
          <button className="src-btn main" onClick={takePhoto} disabled={!imgOk}>
            <span className="ic">
              <Icon n="camera" s={26} />
            </span>
            <span className="grow">
              <b>Sacar foto</b>
              <br />
              <span>De la lista en papel. Podés sumar varias páginas.</span>
            </span>
          </button>
          <button
            className="src-btn"
            onClick={async () => {
              const [f] = await pickFile("application/pdf,.pdf");
              if (f) void readList(app, { kind: "pdf", file: f });
            }}
          >
            <span className="ic">
              <Icon n="file" />
            </span>
            <b>PDF</b>
            <span>La lista que te mandaron por mail o WhatsApp</span>
          </button>
          <button
            className="src-btn"
            onClick={async () => {
              const [f] = await pickFile(".xlsx,.xls,.csv,.ods,text/csv");
              if (f) void readList(app, { kind: "sheet", file: f });
            }}
          >
            <span className="ic">
              <Icon n="sheet" />
            </span>
            <b>Excel o CSV</b>
            <span>Planilla del proveedor</span>
          </button>
          <button className="src-btn" onClick={gallery} disabled={!imgOk}>
            <span className="ic">
              <Icon n="image" />
            </span>
            <b>Fotos guardadas</b>
            <span>Capturas o fotos de la galería</span>
          </button>
          <button
            className="src-btn"
            onClick={() => {
              nl.mode = "text";
              app.render();
            }}
          >
            <span className="ic">
              <Icon n="text" />
            </span>
            <b>Pegar texto</b>
            <span>Copiado de un mensaje o mail</span>
          </button>
        </div>
        {!AI.checked ? (
          <p className="tiny">Preparando la lectura con IA…</p>
        ) : !AI.on ? (
          <div className="warnbox">La lectura con IA no está disponible por ahora. Podés usar Excel, PDF con texto o pegar la lista; Remarcá la lee igual, con menos precisión.</div>
        ) : null}
      </main>
    </>
  );
}
