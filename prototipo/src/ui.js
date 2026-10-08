/* ============ íconos ============ */
const I = {
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  truck:'<path d="M2 6h11v10H2zM13 9h4.5L21 12.5V16h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
  file:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  sheet:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  text:'<path d="M4 6h16M4 12h16M4 18h10"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  back:'<path d="M15 18 9 12l6-6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dl:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
};
/* estrella de cartel de oferta */
function burst(fill, pts = 14, inner = 0.8, extra = ''){
  const P = []; for (let i = 0; i < pts * 2; i++){ const a = Math.PI * i / pts - Math.PI / 2, r = i % 2 ? 46 * inner : 46; P.push((50 + r * Math.cos(a)).toFixed(1) + ',' + (50 + r * Math.sin(a)).toFixed(1)); }
  return `<svg class="burst ${extra}" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${P.join(' ')}" fill="${fill}" stroke="var(--edge)" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
function avatar(name){ let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `<span class="avatar c${h % 5}">${esc((String(name || '?')[0] || '?').toUpperCase())}</span>`; }
const ic = (n, s = 24) => `<svg class="i" viewBox="0 0 24 24" style="width:${s}px;height:${s}px" aria-hidden="true">${I[n]}</svg>`;

/* ============ estado de interfaz ============ */
const ui = {tab: 'home', screen: null, sheet: null, q: '', filter: 'all', plimit: 150, select: false, selected: new Set(), nl: null, proc: null, review: null, imp: null, doneId: null, wipe: false, leave: false};
const boot = {loading: true};

function go(tab){ ui.tab = tab; ui.screen = null; ui.select = false; ui.sheet = null; render(); window.scrollTo(0, 0); }
function screen(name){ ui.screen = name; ui.sheet = null; render(); window.scrollTo(0, 0); }

function syncHTML(){
  if (persist.mode === 'cloud') return persist.pending ? `<span class="sync busy" id="sync"><i></i>Guardando…</span>` : `<span class="sync" id="sync"><i></i>Guardado en tu cuenta</span>`;
  return `<span class="sync local" id="sync" title="${esc(persist.error || '')}"><i></i>En este dispositivo</span>`;
}
function updateSync(){ const el = $('#sync'); if (el) el.outerHTML = syncHTML(); }
function topbar(title, back){ return `<header class="top">${back ? `<button class="back" data-a="${back}" aria-label="Volver">${ic('back')}</button>` : ''}<h1>${esc(title)}</h1>${syncHTML()}</header>`; }
function navHTML(){
  const b = (t, icon, label) => `<button class="${ui.tab === t ? 'on' : ''}" data-a="tab" data-v="${t}">${ic(icon)}<span>${label}</span></button>`;
  return `<nav class="nav"><div class="nav-in">${b('home', 'home', 'Inicio')}${b('prices', 'tag', 'Precios')}<button class="fab" data-a="newlist"><span class="c">${burst('var(--yellow)', 12, 0.78)}${ic('plus', 30)}</span><span>Nueva lista</span></button>${b('suppliers', 'truck', 'Proveedores')}${b('settings', 'gear', 'Ajustes')}</div></nav>`;
}

/* ============ render ============ */
function render(){
  const app = $('#app');
  if (boot.loading){ app.innerHTML = `<div class="proc"><div class="brand"><span class="tag lg"><small>$</small>Remarcá</span></div><p class="muted">Cargando tus precios…</p></div>`; return; }
  if (!S.settings){ app.innerHTML = viewOnboard(); renderSheet(); return; }
  let html = '';
  if (ui.screen) html = (SCREENS[ui.screen] || (() => ''))();
  else html = (TABS[ui.tab] || TABS.home)() + navHTML();
  app.innerHTML = html;
  renderSheet();
}

/* ---------- onboarding ---------- */
function viewOnboard(){
  return `<div class="onb">
    <header class="onb-hero"><span class="deco b1">${burst('var(--yellow)', 16, 0.82)}</span><span class="deco c1"></span>
      <span class="deco tag t1"><small>$</small>1.299</span><span class="deco tag t2"><small>$</small>890</span>
      <div class="brand"><span class="logo">Remarcá</span></div>
      <h2>Tus precios al día, en un toque.</h2>
      <p>Sacale una foto a la lista del proveedor. Remarcá lee los costos, aplica tu margen y te muestra solo lo que cambió.</p>
    </header>
    <div class="card stack">
      <label class="f" for="ob-store">Nombre del comercio<input class="inp" id="ob-store" autocomplete="organization" placeholder="Ej.: Almacén Don Tito"></label>
      <div class="f"><label class="f" for="ob-margin">Margen habitual de ganancia sobre el costo</label>
        <div class="inp-suf"><input class="inp num" id="ob-margin" inputmode="decimal" value="40"><b>%</b></div>
        <div class="seg" style="margin-top:8px">${[30, 35, 40, 50, 60].map(v => `<button type="button" data-a="obMargin" data-v="${v}">${v} %</button>`).join('')}</div>
      </div>
      <div class="f"><span>Redondear precios de venta</span>
        <div class="seg" id="ob-round">${[[0, 'Sin redondeo'], [1, '$ 1'], [10, '$ 10'], [50, '$ 50'], [100, '$ 100']].map(([v, l]) => `<button type="button" class="${v === 10 ? 'on' : ''}" data-a="obRound" data-v="${v}">${l}</button>`).join('')}</div>
        <span class="tiny">Siempre hacia arriba. Lo podés cambiar después en Ajustes.</span>
      </div>
      <button class="btn pink block" data-a="obStart">Empezar</button>
    </div>
    <div class="card flat stack">
      <p><b>¿Querés verla funcionando primero?</b></p>
      <p class="muted small">Cargamos un almacén de ejemplo con 27 productos y dos proveedores. Después lo borrás con un toque.</p>
      <button class="btn sec block" data-a="demo">Probar con datos de ejemplo</button>
    </div>
  </div>`;
}

/* ---------- inicio ---------- */
function viewHome(){
  const st = S.settings;
  const losses = S.products.filter(isLoss).length;
  const stale = S.suppliers.filter(s => s.lastListAt && Date.now() - s.lastListAt > 30 * 86400000);
  const lastAt = S.products.reduce((m, p) => Math.max(m, p.priceAt || 0), 0);
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  let h = `<header class="hero"><span class="deco d1">${burst('var(--yellow)', 16, 0.82)}</span><span class="deco d2"></span><span class="deco d3"></span>
    <div class="row"><span class="grow hello">${saludo}</span>${syncHTML()}</div>
    <h1>${esc(st.store || 'Mi comercio')}</h1></header><main class="wrap">`;
  h += `<button class="hero-cta" data-a="newlist"><span class="ic">${ic('camera', 30)}</span><span class="grow"><b>Nueva lista</b><span class="sub">Foto, PDF o Excel del proveedor</span></span><span class="arrow">${ic('up', 20).replace('<svg', '<svg style="transform:rotate(90deg)"')}</span></button>`;
  if (st.demo) h += `<div class="demo-note">${ic('alert', 20)}<span class="grow">Estás viendo datos de ejemplo.</span><button class="btn sm sec" data-a="wipeDemo">Borrar ejemplo</button></div>`;
  if (st.demo && !S.history.length) h += `<div class="card stack"><p><b>Probá el flujo completo</b></p><p class="muted small">Llegó la lista nueva de Distribuidora del Sur. Leela, revisá los cambios y aplicalos.</p><button class="btn tagb block" data-a="demoList">Usar la lista de ejemplo</button></div>`;
  if (!S.products.length) h += `<div class="card stack"><h2>Cargá tu catálogo</h2><p class="muted small">Podés importar el Excel que ya usás, cargar productos a mano o crearlo directamente desde la primera lista de un proveedor.</p>
    <div class="btns"><button class="btn sec" data-a="importCat">${ic('sheet', 20)}Importar Excel</button><button class="btn sec" data-a="newProduct">${ic('plus', 20)}Cargar a mano</button></div>
    <button class="btn tagb block" data-a="newlist">Crear desde la primera lista</button></div>`;
  if (losses) h += `<button class="alert bad" data-a="seeLoss">${ic('alert')}<span class="grow"><b>${losses} ${losses === 1 ? 'producto se vende' : 'productos se venden'} por debajo del costo</b><span>Tocá para verlos y corregirlos.</span></span></button>`;
  for (const s of stale.slice(0, 2)) h += `<button class="alert warn" data-a="newlistSup" data-id="${s.id}">${ic('clock')}<span class="grow"><b>${esc(s.name)}: última lista ${ago(s.lastListAt)}</b><span>Si te mandó una nueva, cargala para no perder margen.</span></span></button>`;
  h += `<div class="stats"><div class="stat"><b>${NF0.format(S.products.length)}</b><span>productos</span></div><div class="stat"><b>${S.suppliers.length}</b><span>proveedores</span></div><div class="stat"><b style="font-size:17px;line-height:1.5">${lastAt ? ago(lastAt) : '—'}</b><span>última actualización</span></div></div>`;
  if (S.history.length){
    h += `<div class="sec-h"><h3>Últimas listas</h3></div><div class="list">`;
    for (const b of S.history.slice(0, 8)){
      h += `<button class="li" data-a="batch" data-id="${b.id}">${avatar(b.supName)}<span class="grow"><span class="t">${esc(b.supName)}</span><span class="s">${fmtDate(b.at)} · ${batchLine(b)}</span></span><span class="r">${b.undone ? '<span class="chip mute">Deshecha</span>' : `<span class="chip mute">${b.changes.length} cambios</span>`}</span></button>`;
    }
    h += `</div>`;
  }
  return h + `</main>`;
}
function batchLine(b){
  if (b.source === 'recalculo') return 'Recálculo con márgenes';
  const c = b.counts || {}; const p = [];
  if (c.up) p.push(`subieron ${c.up}`); if (c.down) p.push(`bajaron ${c.down}`); if (c.new) p.push(`${c.new} nuevos`);
  return p.join(', ') || 'sin cambios';
}

/* ---------- precios ---------- */
function filteredProducts(){
  const qs = norm(ui.q).split(' ').filter(Boolean);
  let arr = S.products;
  if (ui.filter === 'loss') arr = arr.filter(isLoss);
  else if (ui.filter.startsWith('cat:')) arr = arr.filter(p => (p.category || '') === ui.filter.slice(4));
  else if (ui.filter.startsWith('sup:')) arr = arr.filter(p => p.supplierId === ui.filter.slice(4));
  if (qs.length) arr = arr.filter(p => { const h = norm(`${p.name} ${p.code} ${p.category}`); return qs.every(q => h.includes(q)); });
  return arr.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
function productRow(p){
  const sup = supById(p.supplierId);
  const m = realMargin(p);
  const sub = [p.category, sup?.name, p.code && `cód. ${p.code}`].filter(Boolean).map(esc).join(' · ');
  const chk = ui.select ? `<input type="checkbox" class="chk" data-a="selToggle" data-id="${p.id}" ${ui.selected.has(p.id) ? 'checked' : ''} aria-label="Elegir ${esc(p.name)}">` : '';
  return `<div class="li">${chk}<button class="grow rowbtn" data-a="${ui.select ? 'selToggleRow' : 'product'}" data-id="${p.id}"><span class="grow"><span class="t">${esc(p.name)}</span><span class="s">${sub || 'Sin categoría'}</span></span><span class="r">${moneyHTML(p.price)}${unitTxt(p) || p.lock ? `<span class="tiny">${[unitTxt(p), p.lock ? 'precio fijo' : ''].filter(Boolean).join(' · ')}</span>` : ''}<span class="tiny num">${p.cost ? `costo ${costTxt(p.cost)}` : 'sin costo'}${m != null ? ` · ${isLoss(p) ? `<b style="color:var(--bad)">${pctTxt(m)}</b>` : NF0.format(m) + ' %'}` : ''}</span></span></button></div>`;
}
function priceListHTML(){
  const arr = filteredProducts();
  if (!S.products.length) return `<div class="empty"><p>Todavía no hay productos.</p><div class="btns"><button class="btn sec" data-a="importCat">Importar Excel</button><button class="btn sec" data-a="newProduct">Cargar a mano</button></div></div>`;
  if (!arr.length) return `<div class="empty"><p>No hay productos que coincidan con la búsqueda.</p></div>`;
  return `<p class="tiny" style="padding-inline:2px">${NF0.format(arr.length)} ${arr.length === 1 ? 'producto' : 'productos'}</p><div class="list">${arr.slice(0, ui.plimit).map(productRow).join('')}${arr.length > ui.plimit ? `<button class="more" data-a="moreP">Mostrar ${Math.min(150, arr.length - ui.plimit)} más</button>` : ''}</div>`;
}
function viewPrices(){
  const losses = S.products.filter(isLoss).length;
  const cats = [...new Set(S.products.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const chip = (v, l) => `<button class="${ui.filter === v ? 'on' : ''}" data-a="pfilter" data-v="${esc(v)}">${l}</button>`;
  let h = topbar('Precios') + `<main class="wrap" style="padding-top:0">
    <div class="search">
      <div class="inp-pre"><input class="inp" id="q" type="search" placeholder="Buscar producto, código o categoría" value="${esc(ui.q)}" autocomplete="off"><b>${ic('search', 18)}</b></div>
      <div class="chips seg">${chip('all', 'Todos')}${losses ? chip('loss', `A pérdida (${losses})`) : ''}${cats.map(c => chip('cat:' + c, esc(c))).join('')}${S.suppliers.map(s => chip('sup:' + s.id, esc(s.name))).join('')}</div>
    </div>
    <div class="btns">${ui.select ? `<button class="btn sm sec" data-a="selAll">Elegir todos los de la lista</button><button class="btn sm sec" data-a="selCancel">Cancelar</button>` : `<button class="btn sm sec" data-a="newProduct">${ic('plus', 18)}Producto</button><button class="btn sm sec" data-a="selStart">${ic('tag', 18)}Etiquetas</button><button class="btn sm sec" data-a="exportPrices">${ic('dl', 18)}Excel</button><button class="btn sm sec" data-a="importCat">${ic('sheet', 18)}Importar</button>`}</div>
    <div id="plist" class="stack">${priceListHTML()}</div>
  </main>`;
  if (ui.select) h += `<div class="applybar"><div><span class="grow muted">${ui.selected.size} elegidos</span><button class="btn tagb" data-a="selLabels" ${ui.selected.size ? '' : 'disabled'}>${ic('tag', 20)}Hacer etiquetas</button></div></div>`;
  return h;
}

/* ---------- proveedores ---------- */
function viewSuppliers(){
  let h = topbar('Proveedores') + `<main class="wrap">`;
  if (!S.suppliers.length) h += `<div class="empty"><p>Agregá a tus proveedores para que Remarcá aprenda cómo es la lista de cada uno.</p></div>`;
  else {
    h += `<div class="list">`;
    for (const s of S.suppliers){
      const n = S.products.filter(p => p.supplierId === s.id).length;
      const learned = Object.keys(S.maps[s.id] || {}).length;
      h += `<button class="li" data-a="supplier" data-id="${s.id}">${avatar(s.name)}<span class="grow"><span class="t">${esc(s.name)}</span><span class="s">${s.ivaIncluded ? 'Lista con IVA' : 'Lista sin IVA'}${+s.discount ? ` · bonificación ${NF1.format(s.discount)} %` : ''}</span><span class="s">${n} productos · ${learned} renglones aprendidos · última lista ${ago(s.lastListAt)}</span></span></button>`;
    }
    h += `</div>`;
  }
  h += `<button class="btn sec block" data-a="newSupplier">${ic('plus', 20)}Agregar proveedor</button></main>`;
  return h;
}

/* ---------- ajustes ---------- */
function viewSettings(){
  const st = S.settings;
  const pending = S.products.filter(p => p.cost > 0 && !p.lock && Math.abs(priceFrom(p.cost, p) - p.price) > 0.004).length;
  const segR = [[0, 'Sin redondeo'], [1, '$ 1'], [10, '$ 10'], [50, '$ 50'], [100, '$ 100']].map(([v, l]) => `<button class="${+st.round === v ? 'on' : ''}" data-a="setRound" data-v="${v}">${l}</button>`).join('');
  let h = topbar('Ajustes') + `<main class="wrap">
  <div class="card stack">
    <label class="f" for="s-store">Nombre del comercio<input class="inp" id="s-store" data-set="store" value="${esc(st.store)}"></label>
    <div class="grid2">
      <label class="f" for="s-margin">Margen general<div class="inp-suf"><input class="inp num" id="s-margin" data-set="margin" inputmode="decimal" value="${esc(st.margin)}"><b>%</b></div></label>
      <label class="f" for="s-iva">IVA general<div class="inp-suf"><input class="inp num" id="s-iva" data-set="iva" inputmode="decimal" value="${esc(st.iva)}"><b>%</b></div></label>
    </div>
    <p class="tiny">El IVA se suma al costo solo cuando la lista del proveedor viene sin IVA.</p>
    <div class="f"><span>Redondeo del precio de venta</span><div class="seg">${segR}</div>
      <div class="seg" style="margin-top:4px"><button class="${st.roundMode !== 'near' ? 'on' : ''}" data-a="setRoundMode" data-v="up">Siempre hacia arriba</button><button class="${st.roundMode === 'near' ? 'on' : ''}" data-a="setRoundMode" data-v="near">Al más cercano</button></div></div>
    <div class="f"><span>Terminación del precio</span><div class="seg">${[['', 'Normal'], ['9', 'Termina en 9 ($ 1.299)'], ['90', 'Termina en 90 ($ 1.290)'], ['99', 'Termina en 99 ($ 1.399)']].map(([v, l]) => `<button class="${(st.ending || '') === v ? 'on' : ''}" data-a="setEnding" data-v="${v}">${l}</button>`).join('')}</div>
      ${st.ending ? '<span class="tiny">Con terminación elegida, el redondeo de arriba no se usa.</span>' : ''}</div>
    <label class="f" for="s-big">Resaltar cambios mayores a<div class="inp-suf"><input class="inp num" id="s-big" data-set="bigChange" inputmode="decimal" value="${esc(st.bigChange)}"><b>%</b></div></label>
    ${pending ? `<div class="warnbox"><span>${pending} ${pending === 1 ? 'producto tiene' : 'productos tienen'} un precio distinto al que da tu margen actual.</span><button class="btn sm" data-a="recalc">Recalcular ${pending} precios</button></div>` : ''}
  </div>
  <div class="sec-h"><h3>Márgenes por categoría</h3></div>
  <div class="card stack">
    <p class="tiny">Si una categoría no tiene margen propio, usa el general (${NF1.format(st.margin)} %). Podés poner un IVA distinto, por ejemplo 10,5 %.</p>
    ${(st.categories || []).map((c, i) => `<div class="row" style="flex-wrap:wrap"><b class="grow" style="min-width:120px">${esc(c.name)}</b>
      <div class="inp-suf" style="width:96px"><input class="inp num" data-cat="${i}" data-k="margin" inputmode="decimal" placeholder="${esc(st.margin)}" value="${esc(c.margin ?? '')}" aria-label="Margen de ${esc(c.name)}"><b>%</b></div>
      <div class="inp-suf" style="width:96px"><input class="inp num" data-cat="${i}" data-k="iva" inputmode="decimal" placeholder="IVA" value="${esc(c.iva ?? '')}" aria-label="IVA de ${esc(c.name)}"><b>%</b></div>
      <button class="back" style="width:36px;height:36px;border:0;background:var(--line2);border-radius:50%" data-a="delCat" data-i="${i}" aria-label="Quitar ${esc(c.name)}">${ic('x', 18)}</button></div>`).join('') || '<p class="muted small">Todavía no hay categorías.</p>'}
    <div class="row"><input class="inp grow" id="newcat" placeholder="Nueva categoría"><button class="btn sm" data-a="addCat">Agregar</button></div>
  </div>
  <div class="sec-h"><h3>Tus datos</h3></div>
  <div class="card stack">
    <p class="small muted">${persist.mode === 'cloud' ? 'Tus datos se guardan en tu cuenta y los ves desde cualquier dispositivo.' : (persist.error || 'Tus datos se guardan en este dispositivo. Abrí Remarcá con tu cuenta para guardarlos en la nube.')}</p>
    <div class="btns"><button class="btn sm sec" data-a="backup">${ic('dl', 18)}Descargar copia</button><button class="btn sm sec" data-a="restore">Restaurar copia</button></div>
    ${ui.wipe ? `<div class="errbox stack"><b>¿Borrar todos los datos?</b><span class="small">Se borran productos, proveedores, márgenes e historial. No se puede deshacer.</span><div class="btns"><button class="btn sm danger" data-a="wipeYes">Sí, borrar todo</button><button class="btn sm sec" data-a="wipeNo">Cancelar</button></div></div>` : `<button class="btn sm ghost" data-a="wipe">Borrar todos los datos</button>`}
  </div>
  <p class="tiny" style="text-align:center">Remarcá · versión MVP</p>
  </main>`;
  return h;
}
const TABS = {home: viewHome, prices: viewPrices, suppliers: viewSuppliers, settings: viewSettings};

/* ---------- nueva lista ---------- */
function viewNewList(){
  const nl = ui.nl;
  const sup = nl.supId && supById(nl.supId);
  let h = topbar('Nueva lista', 'nlBack') + `<main class="wrap">`;
  if (!sup){
    h += `<h2>¿De qué proveedor es la lista?</h2><div class="sup-pick">`;
    const sorted = S.suppliers.slice().sort((a, b) => (b.lastListAt || 0) - (a.lastListAt || 0));
    for (const s of sorted) h += `<button data-a="nlSup" data-id="${s.id}">${avatar(s.name)}<span class="grow"><b>${esc(s.name)}</b><br><span class="tiny">Última lista ${ago(s.lastListAt)} · ${s.ivaIncluded ? 'con IVA' : 'sin IVA'}</span></span></button>`;
    h += `</div><div class="card stack"><b>${S.suppliers.length ? 'Otro proveedor' : 'Agregá el proveedor'}</b>
      <input class="inp" id="nl-name" placeholder="Nombre del proveedor" autocomplete="off">
      <label class="toggle small"><span>Los precios de su lista <b>incluyen IVA</b></span><input type="checkbox" id="nl-iva"></label>
      <button class="btn block" data-a="nlNewSup">Continuar</button></div>`;
    return h + `</main>`;
  }
  h += `<div class="row">${avatar(sup.name)}<span class="grow"><b>${esc(sup.name)}</b><br><span class="tiny">${sup.ivaIncluded ? 'Precios con IVA' : 'Precios sin IVA'}${+sup.discount ? ` · bonificación ${NF1.format(sup.discount)} %` : ''}</span></span><button class="btn sm sec" data-a="nlChangeSup">Cambiar</button></div>`;
  if (nl.photos.length){
    h += `<h2>Páginas de la lista</h2><div class="thumbs">${nl.photos.map((p, i) => `<figure><img src="${p.url}" alt="Página ${i + 1}"><button data-a="nlDelPhoto" data-i="${i}" aria-label="Quitar página ${i + 1}">×</button></figure>`).join('')}</div>
      <div class="btns"><button class="btn sec" data-a="nlPhoto">${ic('camera', 20)}Otra página</button><button class="btn tagb" data-a="nlReadPhotos">Leer lista</button></div>`;
    return h + `</main>`;
  }
  if (nl.mode === 'text'){
    h += `<label class="f" for="nl-text">Pegá la lista (por ejemplo, el mensaje de WhatsApp del proveedor)<textarea class="inp" id="nl-text" rows="12" placeholder="YERBA PLAYADITO 1KG  3.950&#10;AZUCAR LEDESMA 1KG  990&#10;…">${esc(nl.text || '')}</textarea></label>
      <div class="btns"><button class="btn sec" data-a="nlMode" data-v="">Volver</button><button class="btn tagb" data-a="nlReadText">Leer lista</button></div>`;
    return h + `</main>`;
  }
  const imgOk = aiImagesOn();
  h += `<div class="src-grid">
    <button class="src-btn main" data-a="nlPhoto" ${imgOk ? '' : 'disabled'}><span class="ic">${ic('camera', 26)}</span><span class="grow"><b>Sacar foto</b><br><span>De la lista en papel. Podés sumar varias páginas.</span></span></button>
    <button class="src-btn" data-a="nlPdf"><span class="ic">${ic('file')}</span><b>PDF</b><span>La lista que te mandaron por mail o WhatsApp</span></button>
    <button class="src-btn" data-a="nlSheet"><span class="ic">${ic('sheet')}</span><b>Excel o CSV</b><span>Planilla del proveedor</span></button>
    <button class="src-btn" data-a="nlGallery" ${imgOk ? '' : 'disabled'}><span class="ic">${ic('image')}</span><b>Fotos guardadas</b><span>Capturas o fotos de la galería</span></button>
    <button class="src-btn" data-a="nlMode" data-v="text"><span class="ic">${ic('text')}</span><b>Pegar texto</b><span>Copiado de un mensaje o mail</span></button>
  </div>`;
  if (!AI.checked) h += `<p class="tiny">Preparando la lectura con IA…</p>`;
  else if (!aiOn()) h += `<div class="warnbox">La lectura con IA no está disponible en este acceso. Podés usar Excel, PDF con texto o pegar la lista; Remarcá la lee igual, con menos precisión.</div>`;
  else if (!imgOk) h += `<p class="tiny">La lectura de fotos no está disponible en este acceso. Usá PDF, Excel o texto.</p>`;
  return h + `</main>`;
}

/* ---------- procesando ---------- */
function viewProcessing(){
  const p = ui.proc; const sup = supById(p.supId);
  let h = topbar('Leyendo la lista', p.error || p.needCols ? 'procBack' : '') + `<main class="wrap">`;
  if (p.needCols){
    const {rows, cols} = p.needCols;
    const ncol = Math.max(...rows.slice(0, 30).map(r => r.length));
    const hdr = cols.header >= 0 ? rows[cols.header] : [];
    const L = j => `Columna ${String.fromCharCode(65 + (j % 26))}${hdr[j] ? ': ' + String(hdr[j]).slice(0, 24) : ''}`;
    const sel = (id, label, val, opt) => `<label class="f" for="${id}">${label}<select class="inp" id="${id}">${opt ? '<option value="-1">No tiene</option>' : ''}${Array.from({length: ncol}, (_, j) => `<option value="${j}" ${j === val ? 'selected' : ''}>${esc(L(j))}</option>`).join('')}</select></label>`;
    h += `<h2>¿En qué columnas está cada dato?</h2><p class="muted small">No pudimos reconocer la planilla sola. Elegí las columnas una vez y Remarcá las recuerda para este proveedor.</p>
      <div class="tbl-wrap"><table class="prev"><tbody>${rows.slice(Math.max(0, cols.header), Math.max(0, cols.header) + 7).map(r => `<tr>${Array.from({length: ncol}, (_, j) => `<td>${esc(String(r[j] ?? '').slice(0, 30))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="card stack">${sel('c-desc', 'Descripción del producto', cols.desc)}${sel('c-cost', 'Precio de costo', cols.cost)}${sel('c-code', 'Código (opcional)', cols.code, true)}</div>
      <button class="btn block" data-a="colsOk">Continuar</button>`;
    return h + `</main>`;
  }
  if (p.error){
    h += `<div class="proc"><div class="errbox">${esc(p.error)}</div><div class="btns" style="width:100%"><button class="btn" data-a="procBack">Probar de nuevo</button></div></div>`;
    return h + `</main>`;
  }
  const stepIx = p.pct < 0.8 ? 0 : p.pct < 0.98 ? 1 : 2;
  const steps = ['Leer productos y costos', 'Buscarlos en tu catálogo', 'Calcular precios de venta'];
  h += `<div class="proc"><div class="scan">${'<i></i>'.repeat(10)}</div><div><h2>${esc(sup?.name || '')}</h2><p class="muted" aria-live="polite">${esc(p.msg || 'Preparando…')}</p></div>
    <div class="bar"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
    <div class="steps">${steps.map((s, i) => `<div class="${i < stepIx ? 'ok' : i === stepIx ? 'on' : ''}">${i < stepIx ? ic('check', 18) : `<span style="width:18px;text-align:center">${i + 1}</span>`}${s}</div>`).join('')}</div>
    <p class="tiny">Puede tardar hasta un minuto por página.</p>
    <button class="btn sec" data-a="procCancel">Cancelar</button></div>`;
  return h + `</main>`;
}
function setProg(msg, pct){
  if (!ui.proc) return;
  ui.proc.msg = msg; if (pct != null) ui.proc.pct = Math.max(ui.proc.pct || 0, pct);
  if (ui.screen === 'processing') render();
}
