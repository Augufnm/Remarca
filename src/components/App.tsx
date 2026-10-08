"use client";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "@/lib/core/pricing";
import { store } from "@/lib/client/store";
import { initAI } from "@/lib/client/ai";
import { Ctx, initialUI, useApp, type AppCtx, type Screen, type Sheet, type Tab, type Toast } from "./ctx";
import { Burst, Icon } from "./bits";
import Onboard from "./screens/Onboard";
import Home from "./screens/Home";
import Prices from "./screens/Prices";
import Suppliers from "./screens/Suppliers";
import SettingsView from "./screens/Settings";
import NewList from "./screens/NewList";
import Processing from "./screens/Processing";
import ReviewView from "./screens/Review";
import Done from "./screens/Done";
import ImportView from "./screens/Import";
import SheetHost from "./sheets/SheetHost";
import { startNewList } from "./actions";

export default function App() {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const ui = useRef(initialUI()).current;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);

  useEffect(() => {
    void store.load();
    void initAI().then(bump);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onScroll = () => document.querySelector(".top")?.classList.toggle("scrolled", window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toast = useCallback((msg: string, action?: Toast["action"]) => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, msg, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 3800);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ui.sheet) {
        ui.sheet = null;
        bump();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ui]);

  const data = store.data;
  const ctx: AppCtx = {
    data,
    st: data.settings || DEFAULT_SETTINGS(),
    idx: store.index(),
    ui,
    render: bump,
    go: (tab: Tab) => {
      ui.tab = tab;
      ui.screen = null;
      ui.select = false;
      ui.sheet = null;
      bump();
      window.scrollTo(0, 0);
    },
    screen: (s: Screen) => {
      ui.screen = s;
      ui.sheet = null;
      bump();
      window.scrollTo(0, 0);
    },
    openSheet: (s: Sheet | null) => {
      ui.sheet = s;
      bump();
    },
    toast,
    mutate: (fn) => store.mutate(fn),
    saveError: store.saveError,
  };

  let body: React.ReactNode;
  if (!store.loaded)
    body = (
      <div className="proc">
        <div className="brand">
          <span className="tag lg">
            <small>$</small>Remarcá
          </span>
        </div>
        <p className="muted">Cargando tus precios…</p>
      </div>
    );
  else if (!data.settings) body = <Onboard />;
  else if (ui.screen) body = <ScreenView s={ui.screen} />;
  else
    body = (
      <>
        {ui.tab === "home" && <Home />}
        {ui.tab === "prices" && <Prices />}
        {ui.tab === "suppliers" && <Suppliers />}
        {ui.tab === "settings" && <SettingsView />}
        <Nav />
      </>
    );

  return (
    <Ctx.Provider value={ctx}>
      <div id="app">{body}</div>
      {store.loaded && ui.sheet && <SheetHost />}
      <div id="toast" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="grow">{t.msg}</span>
            {t.action && (
              <button
                onClick={() => {
                  setToasts((x) => x.filter((y) => y.id !== t.id));
                  t.action!.fn();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ScreenView({ s }: { s: Exclude<Screen, null> }) {
  switch (s) {
    case "newlist":
      return <NewList />;
    case "processing":
      return <Processing />;
    case "review":
      return <ReviewView />;
    case "done":
      return <Done />;
    case "import":
      return <ImportView />;
  }
}

function Nav() {
  const app = useApp();
  const b = (t: Tab, icon: string, label: string) => (
    <button className={app.ui.tab === t ? "on" : ""} onClick={() => app.go(t)}>
      <Icon n={icon} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="nav">
      <div className="nav-in">
        {b("home", "home", "Inicio")}
        {b("prices", "tag", "Precios")}
        <button className="fab" onClick={() => startNewList(app)}>
          <span className="c">
            <Burst fill="var(--yellow)" pts={12} inner={0.78} />
            <Icon n="plus" s={30} />
          </span>
          <span>Nueva lista</span>
        </button>
        {b("suppliers", "truck", "Proveedores")}
        {b("settings", "gear", "Ajustes")}
      </div>
    </nav>
  );
}
