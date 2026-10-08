"use client";
/* Piezas visuales compartidas: íconos, estrella de oferta, etiqueta de precio, barra superior. */
import { useState, type CSSProperties, type ReactNode } from "react";
import { priceTxt } from "@/lib/core/format";
import { useApp } from "./ctx";

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v10H2zM13 9h4.5L21 12.5V16h-8z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  sheet: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </>
  ),
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  back: <path d="M15 18 9 12l6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  dl: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
};

export function Icon({ n, s = 24, style }: { n: string; s?: number; style?: CSSProperties }) {
  return (
    <svg className="i" viewBox="0 0 24 24" style={{ width: s, height: s, ...style }} aria-hidden="true">
      {PATHS[n]}
    </svg>
  );
}

/** Estrella de cartel de oferta. */
export function Burst({ fill, pts = 14, inner = 0.8 }: { fill: string; pts?: number; inner?: number }) {
  const P: string[] = [];
  for (let i = 0; i < pts * 2; i++) {
    const a = (Math.PI * i) / pts - Math.PI / 2,
      r = i % 2 ? 46 * inner : 46;
    P.push((50 + r * Math.cos(a)).toFixed(1) + "," + (50 + r * Math.sin(a)).toFixed(1));
  }
  return (
    <svg className="burst" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={P.join(" ")} fill={fill} stroke="var(--edge)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <span className={`avatar c${h % 5}`}>{(String(name || "?")[0] || "?").toUpperCase()}</span>;
}

export function Money({ v, cls = "" }: { v: number | null | undefined; cls?: string }) {
  const { st } = useApp();
  return (
    <span className={`tag ${cls}`}>
      <small>$</small>
      {priceTxt(v, st.round)}
    </span>
  );
}

export function SyncBadge() {
  const { saveError } = useApp();
  if (saveError)
    return (
      <span className="sync err" title="No se pudo guardar en este dispositivo">
        <i />
        Sin guardar
      </span>
    );
  return (
    <span className="sync local">
      <i />
      En este dispositivo
    </span>
  );
}

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="top">
      {onBack && (
        <button className="back" onClick={onBack} aria-label="Volver">
          <Icon n="back" />
        </button>
      )}
      <h1>{title}</h1>
      <SyncBadge />
    </header>
  );
}

export function SheetHead({ title }: { title: string }) {
  const { openSheet } = useApp();
  return (
    <div className="pane-h">
      <h2>{title}</h2>
      <button className="x" onClick={() => openSheet(null)} aria-label="Cerrar">
        <Icon n="x" s={20} />
      </button>
    </div>
  );
}

/** Selector de categoría con alta en el momento. */
export function CatSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { st, mutate } = useApp();
  const cats = (st.categories || []).map((c) => c.name);
  return (
    <CatSelectInner
      id={id}
      value={value}
      cats={cats}
      onChange={onChange}
      onCreate={(name) => {
        if (!cats.includes(name)) mutate((d) => d.settings!.categories.push({ name, margin: null, iva: null }));
        onChange(name);
      }}
    />
  );
}

function CatSelectInner({ id, value, cats, onChange, onCreate }: { id: string; value: string; cats: string[]; onChange: (v: string) => void; onCreate: (n: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <select
        className="inp"
        id={id}
        value={adding ? "__new" : value}
        onChange={(e) => {
          if (e.target.value === "__new") setAdding(true);
          else {
            setAdding(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Sin categoría</option>
        {cats.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="__new">+ Nueva categoría…</option>
      </select>
      {adding && (
        <div className="row" style={{ marginTop: 6 }}>
          <input className="inp grow" autoFocus placeholder="Nombre de la categoría" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn sm"
            type="button"
            onClick={() => {
              const n = name.trim();
              if (!n) return;
              onCreate(n);
              setAdding(false);
              setName("");
            }}
          >
            Crear
          </button>
        </div>
      )}
    </>
  );
}
