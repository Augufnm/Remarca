"use client";
import { NF0, NF2, costTxt, pctTxt, priceTxt, tidyName } from "@/lib/core/format";
import { candidates, norm } from "@/lib/core/match";
import { hasVal } from "@/lib/core/pricing";
import { calcItem, reviewCalc, summarySentence, type ItemCalc } from "@/lib/core/review";
import type { ReviewItem } from "@/lib/core/types";
import { Burst, Icon, Money, TopBar } from "../bits";
import { useApp, type AppCtx } from "../ctx";
import { applyList } from "../actions";

function Row({ it, c, i }: { it: ReviewItem; c: ItemCalc; i: number }) {
  const app = useApp();
  const name = c.p ? c.p.name : tidyName(it.desc);
  const matchNote =
    it.match === "ia" ? <span className="chip new">vinculado con IA</span> : it.match === "similar" ? <span className="chip mute">nombre parecido</span> : it.match === "manual" ? <span className="chip mute">elegido por vos</span> : null;
  const showSrc = c.p && norm(c.p.name) !== norm(it.desc);
  const chip =
    c.st === "new" ? (
      <span className="chip new">nuevo</span>
    ) : c.pct != null ? (
      <span className={`chip ${c.st === "up" ? "up" : "down"}`}>{pctTxt(c.pct)}</span>
    ) : c.st === "up" ? (
      <span className="chip warn">primer costo</span>
    ) : null;
  const extra = (
    <>
      {c.pack > 1 && <span className="chip mute">precio ÷ {c.pack}</span>} {c.lock && <span className="chip mute">precio fijo</span>} {c.odd && <span className="chip warn">¿cambió la presentación?</span>}
    </>
  );
  const hasExtra = c.pack > 1 || c.lock || c.odd;
  return (
    <div className={`li ${c.big ? "hl" : ""}`}>
      <input
        type="checkbox"
        className="chk"
        checked={it.include}
        aria-label={`Incluir ${name}`}
        onChange={() => {
          it.include = !it.include;
          app.render();
        }}
      />
      <button className="grow rowbtn" onClick={() => app.openSheet({ type: "rvItem", i })}>
        <span className="grow">
          <span className="t">{name}</span>
          <span className="s num">
            Costo {c.oc != null ? `${costTxt(c.oc)} → ${NF2.format(c.nc)}` : costTxt(c.nc)}
            {hasVal(it.override) ? " · precio a mano" : ""}
          </span>
          {(showSrc || matchNote || hasExtra) && (
            <span className="s">
              {matchNote} {extra} {showSrc ? "En la lista: " + it.desc : ""}
            </span>
          )}
        </span>
        <span className="r">
          {c.op != null && <span className="old">$ {priceTxt(c.op, app.st.round)}</span>}
          <Money v={c.np} />
          {c.loss && <span className="chip bad">a pérdida</span>}
          {chip}
        </span>
      </button>
    </div>
  );
}

function resolve(app: AppCtx, i: number, patch: Partial<ReviewItem>) {
  Object.assign(app.ui.review!.items[i], patch);
  app.ui.sheet = null;
  app.render();
}

export const rvActions = {
  yes: (app: AppCtx, i: number) => {
    const it = app.ui.review!.items[i];
    resolve(app, i, { productId: it.suggest || null, doubt: false, include: true, match: "manual" });
  },
  isNew: (app: AppCtx, i: number) => resolve(app, i, { productId: null, doubt: false, include: true, match: null }),
  ignore: (app: AppCtx, i: number) => resolve(app, i, { productId: null, doubt: false, ignored: true, include: false }),
  pick: (app: AppCtx, i: number) => app.openSheet({ type: "pick", i }),
};

export default function ReviewView() {
  const app = useApp();
  const { ui, st, idx, data } = app;
  const R = ui.review;
  const sup = R ? data.suppliers.find((s) => s.id === R.supId) : undefined;
  if (!R || !sup) return null;
  const { C, n, apply } = reviewCalc(st, idx, R, sup);
  const ix = (state: string) => R.items.map((_, i) => i).filter((i) => C[i].st === state);
  const f = R.filter;
  const totalCh = n.up + n.down + n.new;
  const filt = (v: "up" | "down" | "new") => {
    R.filter = R.filter === v ? null : v;
    app.render();
  };
  const open = (k: string) => {
    R.open[k] = true;
    app.render();
  };

  const iva = R.meta?.iva;
  const ivaEff = R.ivaOverride ?? !!sup.ivaIncluded;
  const dq = ix("doubt");
  const section = (title: string, list: number[], key: string) => {
    if (!list.length) return null;
    const lim = R.open[key] ? list.length : 40;
    return (
      <>
        <div className="sec-h">
          <h3>{title}</h3>
        </div>
        <div className="list">
          {list.slice(0, lim).map((i) => (
            <Row key={i} it={R.items[i]} c={C[i]} i={i} />
          ))}
          {list.length > lim && (
            <button className="more" onClick={() => open(key)}>
              Ver {list.length - lim} más
            </button>
          )}
        </div>
      </>
    );
  };
  const ups = ix("up"),
    downs = ix("down"),
    news = ix("new");
  const big = [...ups, ...downs].filter((i) => C[i].big);
  const bySize = (a: number, b: number) => Math.abs(C[b].pct ?? 0) - Math.abs(C[a].pct ?? 0);
  const cats = st.categories.map((c) => c.name);
  const same = ix("same");
  const ign = ix("ignored");

  return (
    <>
      <TopBar
        title="Revisá y confirmá"
        onBack={() => {
          R.leave = true;
          app.render();
          window.scrollTo(0, 0);
        }}
      />
      <main className="wrap" style={{ paddingBottom: 110 }}>
        {R.leave && (
          <div className="errbox stack">
            <b>¿Descartar esta lista?</b>
            <span className="small">Los precios no se van a actualizar.</span>
            <div className="btns">
              <button
                className="btn sm danger"
                onClick={() => {
                  ui.review = null;
                  ui.nl = null;
                  app.go("home");
                }}
              >
                Descartar
              </button>
              <button
                className="btn sm sec"
                onClick={() => {
                  R.leave = false;
                  app.render();
                }}
              >
                Seguir revisando
              </button>
            </div>
          </div>
        )}
        <section className="sum">
          {totalCh > 0 && (
            <span className="burst-badge">
              <Burst fill="var(--yellow)" pts={14} inner={0.8} />
              <span>
                <b>{totalCh}</b>cambios
              </span>
            </span>
          )}
          <p className="tiny" style={{ maxWidth: "75%" }}>
            {sup.name}
            {R.fileName ? " · " + R.fileName : ""} · {R.items.length} renglones leídos
          </p>
          <h2 style={{ marginTop: 6 }}>{summarySentence(n)}</h2>
          <div className="sum-nums">
            <button className={`up ${f === "up" ? "on" : ""}`} onClick={() => filt("up")}>
              <b>{n.up}</b>
              <span>Subieron</span>
            </button>
            <button className={`down ${f === "down" ? "on" : ""}`} onClick={() => filt("down")}>
              <b>{n.down}</b>
              <span>Bajaron</span>
            </button>
            <button className={`new ${f === "new" ? "on" : ""}`} onClick={() => filt("new")}>
              <b>{n.new}</b>
              <span>Nuevos</span>
            </button>
          </div>
          <p className="tiny" style={{ marginTop: 10 }}>
            {n.same} sin cambios
            {n.ignored ? ` · ${n.ignored} que no vendés` : ""}
            {n.doubt ? (
              <>
                {" · "}
                <b style={{ color: "var(--warn)" }}>{n.doubt} para confirmar</b>
              </>
            ) : null}
          </p>
        </section>

        {R.warn.map((w, k) => (
          <div className="warnbox" key={k}>
            {w}
          </div>
        ))}
        {(iva === "incluido" && !ivaEff) || (iva === "no_incluido" && ivaEff) ? (
          <div className="warnbox">
            <span>
              La lista parece tener precios <b>{iva === "incluido" ? "con" : "sin"} IVA</b>, pero {sup.name} está configurado {ivaEff ? "con" : "sin"} IVA.
            </span>
            <div className="btns">
              <button
                className="btn sm"
                onClick={() => {
                  R.ivaOverride = iva === "incluido";
                  app.render();
                }}
              >
                Tomar precios {iva === "incluido" ? "con" : "sin"} IVA
              </button>
              <button
                className="btn sm sec"
                onClick={() => {
                  R.meta.iva = null;
                  app.render();
                }}
              >
                Dejar como está
              </button>
            </div>
          </div>
        ) : R.ivaOverride != null ? (
          <div className="warnbox">
            <span>Precios tomados {R.ivaOverride ? "con" : "sin"} IVA para esta lista.</span>
            <div className="btns">
              <button
                className="btn sm sec"
                onClick={() => {
                  const v = !!R.ivaOverride;
                  app.mutate((d) => {
                    d.suppliers.find((s) => s.id === R.supId)!.ivaIncluded = v;
                  });
                  R.ivaOverride = null;
                  app.toast(`${sup.name} quedó configurado ${v ? "con" : "sin"} IVA.`);
                }}
              >
                Recordarlo para {sup.name}
              </button>
            </div>
          </div>
        ) : null}

        {dq.length > 0 && !f && (
          <>
            <div className="sec-h">
              <h3>
                Confirmá {dq.length} {dq.length === 1 ? "coincidencia" : "coincidencias"}
              </h3>
            </div>
            {dq.map((i) => {
              const it = R.items[i];
              const p = it.suggest ? idx.byId.get(it.suggest) : undefined;
              return (
                <div className="doubt" key={i}>
                  <span className="tiny">En la lista dice</span>
                  <span className="src">
                    {it.desc}
                    {it.code ? ` · cód. ${it.code}` : ""} · {costTxt(+it.listed)}
                  </span>
                  {p && (
                    <span>
                      ¿Es <b>{p.name}</b>?
                    </span>
                  )}
                  <div className="btns">
                    {p && (
                      <button className="btn sm" onClick={() => rvActions.yes(app, i)}>
                        Sí, es ese
                      </button>
                    )}
                    <button className="btn sm sec" onClick={() => rvActions.pick(app, i)}>
                      Elegir otro
                    </button>
                    <button className="btn sm sec" onClick={() => rvActions.isNew(app, i)}>
                      Es nuevo
                    </button>
                    <button className="btn sm ghost" onClick={() => rvActions.ignore(app, i)}>
                      No lo vendo
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {(!f || f === "up" || f === "down") && (
          <>
            {!f && big.length > 0 && section(`Cambios grandes (más de ${NF0.format(st.bigChange)} %)`, big.sort(bySize), "big")}
            {(!f || f === "up") && section("Subieron", ups.filter((i) => f || !C[i].big).sort(bySize), "up")}
            {(!f || f === "down") && section("Bajaron", downs.filter((i) => f || !C[i].big).sort(bySize), "down")}
          </>
        )}

        {(!f || f === "new") && news.length > 0 && (
          <>
            <div className="card flat stack" style={{ padding: 12 }}>
              <p className="small">Los productos nuevos que marques se agregan a tu catálogo. Los que no marques se ocultan en las próximas listas de este proveedor.</p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    className="btn sm sec"
                    onClick={() => {
                      R.items.forEach((it) => {
                        if (calcItem(st, idx, it, R, sup).st === "new") it.include = v;
                      });
                      app.render();
                    }}
                  >
                    {v ? "Marcar todos" : "Ninguno"}
                  </button>
                ))}
                {cats.length > 0 && (
                  <select
                    className="inp"
                    style={{ flex: 1, minWidth: 160, minHeight: 38, padding: "6px 10px" }}
                    aria-label="Categoría para los nuevos"
                    value={R.newCat}
                    onChange={(e) => {
                      R.newCat = e.target.value;
                      app.render();
                    }}
                  >
                    <option value="">Categoría para los nuevos…</option>
                    {cats.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {section("Nuevos", news, "new")}
          </>
        )}

        {!f && (
          <>
            {same.length > 0 &&
              (R.open.same ? (
                section("Sin cambios", same, "sameall")
              ) : (
                <button className="btn ghost block" onClick={() => open("same")}>
                  Ver {same.length} sin cambios
                </button>
              ))}
            {ign.length > 0 &&
              (R.open.ign ? (
                <>
                  <div className="sec-h">
                    <h3>No los vendés</h3>
                  </div>
                  <div className="list">
                    {ign.map((i) => (
                      <div className="li" key={i}>
                        <span className="grow">
                          <span className="t">{R.items[i].desc}</span>
                          <span className="s">{costTxt(+R.items[i].listed)} en la lista</span>
                        </span>
                        <button
                          className="btn sm sec"
                          onClick={() => {
                            const it = R.items[i];
                            it.ignored = false;
                            it.include = true;
                            it.match = null;
                            const cs = candidates(idx, it.desc, R.supId);
                            it.cands = cs.map((x) => x.id);
                            if (cs[0] && cs[0].score >= 0.42) {
                              it.doubt = true;
                              it.suggest = cs[0].id;
                              it.include = false;
                            }
                            app.render();
                          }}
                        >
                          Lo vendo
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <button className="btn ghost block" onClick={() => open("ign")}>
                  Ver {ign.length} que no vendés
                </button>
              ))}
          </>
        )}
        {!apply && !dq.length && (
          <div className="empty">
            <p>No hay precios para actualizar en esta lista.</p>
          </div>
        )}
      </main>
      <div className="applybar">
        <div>
          <span className="grow small">
            {dq.length ? (
              <>
                <b style={{ color: "var(--warn)" }}>{dq.length} sin confirmar</b> no se aplican
              </>
            ) : (
              <>
                <b>{apply}</b> {apply === 1 ? "cambio" : "cambios"} marcados
              </>
            )}
          </span>
          <button className="btn tagb" disabled={!(apply || n.same)} onClick={() => applyList(app)}>
            <Icon n="check" s={20} />
            Aplicar{apply ? " " + apply : ""}
          </button>
        </div>
      </div>
    </>
  );
}
