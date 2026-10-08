/* ============ flujo de lectura ============ */
async function runPipeline(kind, payload){
  const sup = supById(ui.nl.supId);
  const ctl = new AbortController();
  ui.proc = {supId: sup.id, msg: 'Preparando…', pct: 0.03, ctl, error: null, needCols: null};
  screen('processing');
  const prog = (m, p) => { if (!ctl.signal.aborted) setProg(m, p); };
  try {
    let res = {items: [], warn: [], meta: {}}, fileName = payload?.name || '', source = kind;
    if (kind === 'images'){
      prog('Preparando las fotos', 0.1);
      const blobs = [];
      for (const ph of payload.photos) blobs.push(await shrinkImage(ph.file));
      if (!aiImagesOn()) throw new UserErr('La lectura de fotos no está disponible en este acceso. Subí la lista en PDF, Excel o como texto.');
      res = await aiExtractImages(blobs, sup, ctl.signal, prog);
      fileName = `${blobs.length} ${blobs.length === 1 ? 'foto' : 'fotos'}`;
    } else if (kind === 'pdf'){
      prog('Abriendo el PDF', 0.08);
      const r = await readPdf(payload, prog);
      if (r.images){
        if (!aiImagesOn()) throw new UserErr('Este PDF es una imagen escaneada y para leerlo hace falta la IA, que no está disponible en este acceso. Pedile al proveedor la lista en Excel o pegala como texto.');
        res = await aiExtractImages(r.images, sup, ctl.signal, prog);
      } else if (aiOn()) res = await aiExtractText(r.lines, sup, ctl.signal, prog);
      else res = {items: heuristicLines(r.lines), warn: ['Se leyó sin IA. Revisá que los productos y precios sean correctos.'], meta: {}};
    } else if (kind === 'sheet'){
      prog('Abriendo la planilla', 0.1);
      const rows = await readSheetRows(payload);
      if (!rows.length) throw new UserErr('La planilla está vacía.');
      let cols = null, meta = {};
      if (sup.cols && rows[sup.cols.header + 1]) cols = sup.cols;
      if (!cols && aiOn()){
        prog('Reconociendo las columnas con IA', 0.3);
        try { const r = await aiDetectCols(rows, sup, ctl.signal); if (r){ cols = r.cols; meta = r.meta; } } catch (e) { if (e?.code === 'cancelled') throw e; }
      }
      if (!cols){ const g = guessCols(rows, false); if (g.desc >= 0 && g.cost >= 0 && rowsToItems(rows, g).length >= Math.min(3, rows.length - 1)) cols = g; }
      let items = cols ? rowsToItems(rows, cols) : [];
      if (!items.length){
        cols = await new Promise((resolve, reject) => { ui.proc.needCols = {rows, cols: cols || guessCols(rows, false), resolve, reject}; render(); });
        ui.proc.needCols = null; render();
        items = rowsToItems(rows, cols);
        sup.cols = cols; save('suppliers');
      } else if (cols !== sup.cols){ sup.cols = cols; save('suppliers'); }
      res = {items, warn: [], meta};
    } else if (kind === 'text'){
      const lines = String(payload.text).split(/\r?\n/);
      fileName = 'Texto pegado';
      if (aiOn()) res = await aiExtractText(lines, sup, ctl.signal, prog);
      else res = {items: heuristicLines(lines), warn: ['Se leyó sin IA. Revisá que los productos y precios sean correctos.'], meta: {}};
    }
    if (ctl.signal.aborted) return;
    // limpiar y quitar duplicados
    const seen = new Map();
    for (const it of res.items){ if (!(it.cost > 0) || it.cost > 1e9) continue; seen.set(itemKey(it.code, it.desc), it); }
    const raw = [...seen.values()];
    if (!raw.length) throw new UserErr(res.warn?.[0] || 'No encontramos productos con precio en la lista. Probá con una foto más nítida o con el archivo original.');
    prog('Buscando cada producto en tu catálogo', 0.82);
    await new Promise(r => setTimeout(r, 30));
    const items = matchItems(raw, sup);
    const doubts = items.filter(i => i.doubt);
    if (doubts.length && aiOn() && doubts.length <= 200){
      try { await aiResolveDoubts(doubts, ctl.signal, prog); } catch (e) { if (e?.code === 'cancelled') return; }
    }
    if (ctl.signal.aborted) return;
    for (const it of items) if (!it.productId && !it.doubt && !it.ignored) it.include = S.products.length < 10;
    if (res.meta?.columna && !sup.aiHint){ sup.aiHint = `Precio tomado de: ${res.meta.columna}`; save('suppliers'); }
    prog('Calculando precios de venta', 0.99);
    ui.review = {supId: sup.id, items, source, fileName, meta: res.meta || {}, warn: res.warn || [], filter: null, newCat: '', ivaOverride: null, open: {}, leave: false};
    ui.proc = null;
    screen('review');
  } catch (e) {
    if (ctl.signal.aborted || e?.code === 'cancelled') return;
    console.error(e);
    if (ui.proc){ ui.proc.error = e instanceof UserErr ? e.message : (e?.code ? aiErrMsg(e) : 'No se pudo leer el archivo. Verificá que sea una lista de precios y probá de nuevo.'); ui.proc.needCols = null; render(); }
  }
}

/* ============ revisión ============ */
function calcItem(it, R, sup){
  const o = {st: '', nc: 0, np: 0, oc: null, op: null, pct: null, big: false, p: null, pack: 1, lock: false, loss: false, odd: false};
  if (it.ignored){ o.st = 'ignored'; }
  else if (it.doubt){ o.st = 'doubt'; }
  const p = it.productId ? byId(it.productId) : null; o.p = p;
  const cat = p ? p.category : (it.newCat || R.newCat || '');
  o.pack = it.pack ? +it.pack : (p && p.buy ? packOf(p) : (it.aiPack || 1));
  o.nc = costFromList(it.listed, sup, cat, R.ivaOverride, o.pack);
  if (o.st) { o.np = priceFrom(o.nc, p || {category: cat}); return o; }
  if (!p){ o.st = 'new'; o.np = hasVal(it.override) ? +it.override : priceFrom(o.nc, {category: cat}); o.loss = o.np < o.nc - 0.005; return o; }
  o.oc = p.cost; o.op = p.price; o.lock = !!p.lock;
  o.np = hasVal(it.override) ? +it.override : (p.lock ? p.price : priceFrom(o.nc, p));
  o.loss = o.np < o.nc - 0.005;
  const dc = o.nc - o.oc, dp = o.np - o.op;
  if (Math.abs(dc) < 0.005 && Math.abs(dp) < 0.005) o.st = 'same';
  else o.st = (dc > 0.004 || (Math.abs(dc) <= 0.004 && dp > 0)) ? 'up' : 'down';
  o.pct = o.oc > 0 ? (o.nc / o.oc - 1) * 100 : null;
  o.big = o.pct != null && Math.abs(o.pct) >= (+S.settings.bigChange || 20);
  o.odd = o.pct != null && (o.pct > 150 || o.pct < -60);
  if (o.loss) o.big = true;
  return o;
}
function reviewCalc(){
  const R = ui.review, sup = supById(R.supId);
  const C = R.items.map(it => calcItem(it, R, sup));
  const n = {up: 0, down: 0, new: 0, same: 0, ignored: 0, doubt: 0};
  C.forEach(c => n[c.st]++);
  let apply = 0;
  R.items.forEach((it, i) => { const c = C[i]; if ((c.st === 'up' || c.st === 'down' || c.st === 'new') && it.include) apply++; });
  return {R, sup, C, n, apply};
}
function rvRow(it, c, i){
  const name = c.p ? c.p.name : tidyName(it.desc);
  const matchNote = it.match === 'ia' ? '<span class="chip new">vinculado con IA</span>' : it.match === 'similar' ? '<span class="chip mute">nombre parecido</span>' : it.match === 'manual' ? '<span class="chip mute">elegido por vos</span>' : '';
  const showSrc = c.p && norm(c.p.name) !== norm(it.desc);
  let chip = c.st === 'new' ? '<span class="chip new">nuevo</span>' : c.pct != null ? `<span class="chip ${c.st === 'up' ? 'up' : 'down'}">${pctTxt(c.pct)}</span>` : (c.st === 'up' ? '<span class="chip warn">primer costo</span>' : '');
  if (c.loss) chip = '<span class="chip bad">a pérdida</span>' + chip;
  const extra = [c.pack > 1 ? `<span class="chip mute">precio ÷ ${c.pack}</span>` : '', c.lock ? '<span class="chip mute">precio fijo</span>' : '', c.odd ? '<span class="chip warn">¿cambió la presentación?</span>' : ''].join(' ');
  return `<div class="li ${c.big ? 'hl' : ''}"><input type="checkbox" class="chk" data-a="rvToggle" data-i="${i}" ${it.include ? 'checked' : ''} aria-label="Incluir ${esc(name)}">
    <button class="grow rowbtn" data-a="rvItem" data-i="${i}"><span class="grow"><span class="t">${esc(name)}</span>
      <span class="s num">Costo ${c.oc != null ? `${costTxt(c.oc)} → ${NF2.format(c.nc)}` : costTxt(c.nc)}${hasVal(it.override) ? ' · precio a mano' : ''}</span>
      ${showSrc || matchNote || extra.trim() ? `<span class="s">${matchNote} ${extra} ${showSrc ? 'En la lista: ' + esc(it.desc) : ''}</span>` : ''}</span>
      <span class="r">${c.op != null ? `<span class="old">$ ${priceTxt(c.op)}</span>` : ''}${moneyHTML(c.np)}${chip}</span></button></div>`;
}
function viewReview(){
  const {R, sup, C, n, apply} = reviewCalc();
  const idx = st => R.items.map((it, i) => i).filter(i => C[i].st === st);
  const f = R.filter;
  const parts = [];
  if (n.up) parts.push(`subieron ${n.up}`); if (n.down) parts.push(`bajaron ${n.down}`); if (n.new) parts.push(`hay ${n.new} ${n.new === 1 ? 'nuevo' : 'nuevos'}`);
  let sentence = parts.length ? parts.join(', ').replace(/, ([^,]*)$/, ' y $1') : 'no hay cambios de precio';
  sentence = sentence[0].toUpperCase() + sentence.slice(1) + '.';
  let h = topbar('Revisá y confirmá', 'rvBack') + `<main class="wrap" style="padding-bottom:110px">`;
  if (R.leave) h += `<div class="errbox stack"><b>¿Descartar esta lista?</b><span class="small">Los precios no se van a actualizar.</span><div class="btns"><button class="btn sm danger" data-a="rvDiscard">Descartar</button><button class="btn sm sec" data-a="rvStay">Seguir revisando</button></div></div>`;
  const totalCh = n.up + n.down + n.new;
  h += `<section class="sum">${totalCh ? `<span class="burst-badge">${burst('var(--yellow)', 14, 0.8)}<span><b>${totalCh}</b>cambios</span></span>` : ''}<p class="tiny" style="max-width:75%">${esc(sup.name)}${R.fileName ? ' · ' + esc(R.fileName) : ''} · ${R.items.length} renglones leídos</p><h2 style="margin-top:6px">${sentence}</h2>
    <div class="sum-nums">
      <button class="up ${f === 'up' ? 'on' : ''}" data-a="rvFilter" data-v="up"><b>${n.up}</b><span>Subieron</span></button>
      <button class="down ${f === 'down' ? 'on' : ''}" data-a="rvFilter" data-v="down"><b>${n.down}</b><span>Bajaron</span></button>
      <button class="new ${f === 'new' ? 'on' : ''}" data-a="rvFilter" data-v="new"><b>${n.new}</b><span>Nuevos</span></button>
    </div>
    <p class="tiny" style="margin-top:10px">${n.same} sin cambios${n.ignored ? ` · ${n.ignored} que no vendés` : ''}${n.doubt ? ` · <b style="color:var(--warn)">${n.doubt} para confirmar</b>` : ''}</p></section>`;
  for (const w of R.warn) h += `<div class="warnbox">${esc(w)}</div>`;
  const iva = R.meta?.iva;
  const ivaEff = R.ivaOverride ?? !!sup.ivaIncluded;
  if ((iva === 'incluido' && !ivaEff) || (iva === 'no_incluido' && ivaEff)){
    h += `<div class="warnbox"><span>La lista parece tener precios <b>${iva === 'incluido' ? 'con' : 'sin'} IVA</b>, pero ${esc(sup.name)} está configurado ${ivaEff ? 'con' : 'sin'} IVA.</span><div class="btns"><button class="btn sm" data-a="rvIva" data-v="${iva === 'incluido' ? 1 : 0}">Tomar precios ${iva === 'incluido' ? 'con' : 'sin'} IVA</button><button class="btn sm sec" data-a="rvIvaKeep">Dejar como está</button></div></div>`;
  } else if (R.ivaOverride != null){
    h += `<div class="warnbox"><span>Precios tomados ${R.ivaOverride ? 'con' : 'sin'} IVA para esta lista.</span><div class="btns"><button class="btn sm sec" data-a="rvIvaSave">Recordarlo para ${esc(sup.name)}</button></div></div>`;
  }
  // dudas
  const dq = idx('doubt');
  if (dq.length && !f){
    h += `<div class="sec-h"><h3>Confirmá ${dq.length} ${dq.length === 1 ? 'coincidencia' : 'coincidencias'}</h3></div>`;
    for (const i of dq){
      const it = R.items[i]; const p = byId(it.suggest);
      h += `<div class="doubt"><span class="tiny">En la lista dice</span><span class="src">${esc(it.desc)}${it.code ? ` · cód. ${esc(it.code)}` : ''} · ${costTxt(+it.listed)}</span>
        ${p ? `<span>¿Es <b>${esc(p.name)}</b>?</span>` : ''}
        <div class="btns">${p ? `<button class="btn sm" data-a="rvYes" data-i="${i}">Sí, es ese</button>` : ''}<button class="btn sm sec" data-a="rvPick" data-i="${i}">Elegir otro</button><button class="btn sm sec" data-a="rvNew" data-i="${i}">Es nuevo</button><button class="btn sm ghost" data-a="rvIgnore" data-i="${i}">No lo vendo</button></div></div>`;
    }
  }
  const section = (title, list, key, extra = '') => {
    if (!list.length) return '';
    const lim = R.open[key] ? list.length : 40;
    return `<div class="sec-h"><h3>${title}</h3>${extra}</div><div class="list">${list.slice(0, lim).map(i => rvRow(R.items[i], C[i], i)).join('')}${list.length > lim ? `<button class="more" data-a="rvMore" data-v="${key}">Ver ${list.length - lim} más</button>` : ''}</div>`;
  };
  const ups = idx('up'), downs = idx('down'), news = idx('new');
  const big = [...ups, ...downs].filter(i => C[i].big);
  const bySize = (a, b) => Math.abs(C[b].pct ?? 0) - Math.abs(C[a].pct ?? 0);
  if (!f || f === 'up' || f === 'down'){
    if (!f && big.length) h += section(`Cambios grandes (más de ${NF0.format(S.settings.bigChange)} %)`, big.sort(bySize), 'big');
    if (!f || f === 'up') h += section('Subieron', ups.filter(i => f || !C[i].big).sort(bySize), 'up');
    if (!f || f === 'down') h += section('Bajaron', downs.filter(i => f || !C[i].big).sort(bySize), 'down');
  }
  if (!f || f === 'new'){
    if (news.length){
      const cats = (S.settings.categories || []).map(c => c.name);
      h += `<div class="card flat stack" style="padding:12px"><p class="small">Los productos nuevos que marques se agregan a tu catálogo. Los que no marques se ocultan en las próximas listas de este proveedor.</p>
        <div class="row" style="flex-wrap:wrap"><button class="btn sm sec" data-a="rvAllNew" data-v="1">Marcar todos</button><button class="btn sm sec" data-a="rvAllNew" data-v="0">Ninguno</button>
        ${cats.length ? `<select class="inp" style="flex:1;min-width:160px;min-height:38px;padding:6px 10px" data-ch="rvNewCat" aria-label="Categoría para los nuevos"><option value="">Categoría para los nuevos…</option>${cats.map(c => `<option ${R.newCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}</div></div>`;
      h += section('Nuevos', news, 'new');
    }
  }
  if (!f){
    const same = idx('same');
    if (same.length) h += R.open.same ? section('Sin cambios', same, 'sameall') : `<button class="btn ghost block" data-a="rvMore" data-v="same">Ver ${same.length} sin cambios</button>`;
    const ign = idx('ignored');
    if (ign.length) h += R.open.ign ? `<div class="sec-h"><h3>No los vendés</h3></div><div class="list">${ign.map(i => `<div class="li"><span class="grow"><span class="t">${esc(R.items[i].desc)}</span><span class="s">${costTxt(+R.items[i].listed)} en la lista</span></span><button class="btn sm sec" data-a="rvUnignore" data-i="${i}">Lo vendo</button></div>`).join('')}</div>` : `<button class="btn ghost block" data-a="rvMore" data-v="ign">Ver ${ign.length} que no vendés</button>`;
  }
  if (!apply && !dq.length) h += `<div class="empty"><p>No hay precios para actualizar en esta lista.</p></div>`;
  h += `</main><div class="applybar"><div><span class="grow small">${dq.length ? `<b style="color:var(--warn)">${dq.length} sin confirmar</b> no se aplican` : `<b>${apply}</b> ${apply === 1 ? 'cambio' : 'cambios'} marcados`}</span><button class="btn tagb" data-a="apply" ${apply || n.same ? '' : 'disabled'}>${ic('check', 20)}Aplicar${apply ? ' ' + apply : ''}</button></div></div>`;
  return h;
}

function applyReview(){
  const {R, sup, C} = reviewCalc();
  const now = Date.now();
  const maps = S.maps[sup.id] || (S.maps[sup.id] = {});
  const changes = []; const counts = {up: 0, down: 0, new: 0};
  R.items.forEach((it, i) => {
    const c = C[i];
    if (c.st === 'ignored' || c.st === 'doubt') return;
    if (c.st === 'new'){
      if (it.include){
        const cat = it.newCat || R.newCat || '';
        const p = {id: newId(), code: it.code || '', name: tidyName(it.desc), category: cat, supplierId: sup.id, cost: c.nc, price: c.np, margin: null, updatedAt: now, priceAt: now, buy: c.pack > 1 ? {type: 'pack', n: c.pack} : {type: 'u'}, sell: 'u'};
        pushHist(p, now);
        S.products.push(p); invalidateIndex();
        maps[it.key] = p.id; changes.push({id: p.id, b: null, a: {cost: p.cost, price: p.price}}); counts.new++;
      } else maps[it.key] = '-';
      return;
    }
    maps[it.key] = it.productId;
    const p = c.p;
    if (c.st === 'same'){ p.checkedAt = now; return; }
    if (!it.include) return;
    const b = {cost: p.cost, price: p.price, updatedAt: p.updatedAt || null, priceAt: p.priceAt || null, supplierId: p.supplierId || null, checkedAt: p.checkedAt || null, buy: p.buy ? {...p.buy} : null, hist: (p.hist || []).slice()};
    p.cost = c.nc; p.updatedAt = now; p.checkedAt = now; p.supplierId = sup.id;
    if (c.pack !== packOf(p) && !(p.buy?.type === 'kg')) p.buy = c.pack > 1 ? {type: 'pack', n: c.pack} : {type: 'u'};
    if (Math.abs(p.price - c.np) > 0.004){ p.price = c.np; p.priceAt = now; }
    pushHist(p, now);
    changes.push({id: p.id, b, a: {cost: p.cost, price: p.price}});
    counts[c.st]++;
  });
  if (R.ivaOverride != null && R.ivaSave){ sup.ivaIncluded = !!R.ivaOverride; }
  const prevListAt = sup.lastListAt || null;
  sup.lastListAt = now; sup.lists = (sup.lists || 0) + 1;
  const batch = {id: newId(), at: now, supId: sup.id, supName: sup.name, source: R.source, file: R.fileName, counts, changes, undone: false, prevListAt};
  S.history.unshift(batch);
  if (S.history.length > 25) S.history.length = 25;
  save('products', 'maps', 'suppliers', 'history');
  ui.review = null; ui.nl = null; ui.doneId = batch.id;
  screen('done');
  if (changes.length) confetti();
}
function confetti(){
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--yellow', '--pink', '--sky', '--lime', '--orange', '--blue'].map(v => cs.getPropertyValue(v).trim() || '#FFE135');
  const P = Array.from({length: 60}, () => ({x: W / 2 + (Math.random() - .5) * 80, y: H * 0.32, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .35, w: 7 + Math.random() * 7, h: 4 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], s: Math.random() < .3}));
  let t = 0;
  (function frame(){
    ctx.clearRect(0, 0, W, H); t++;
    for (const p of P){ p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.strokeStyle = '#17112F'; ctx.lineWidth = 1.2;
      if (p.s){ ctx.beginPath(); ctx.arc(0, 0, p.h, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore(); }
    if (t < 110) requestAnimationFrame(frame); else cv.remove();
  })();
}
function tidyName(s){
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase() && /[A-Z]/.test(s)){
    s = s.toLowerCase().replace(/(^|[\s(\/-])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase());
    s = s.replace(/\b(\d+(?:[.,]\d+)?)\s?(Kg|Kgs|Gr|Grs|G|Ml|Cc|Lt|Lts|L|Un|U)\b/g, (m, n, u) => n + ' ' + ({kg: 'kg', kgs: 'kg', gr: 'g', grs: 'g', g: 'g', ml: 'ml', cc: 'cc', lt: 'l', lts: 'l', l: 'l', un: 'u', u: 'u'}[u.toLowerCase()]));
    s = s.replace(/\b(De|Del|La|El|Con|Sin|En|Y|X|Para)\b/g, w => w.toLowerCase());
    s = s[0].toUpperCase() + s.slice(1);
  }
  return s;
}
function lastUndoable(){ return S.history.find(h => !h.undone); }
function undoBatch(id){
  const b = S.history.find(h => h.id === id);
  if (!b || b.undone || lastUndoable()?.id !== id) return;
  const del = new Set();
  for (const ch of b.changes.slice().reverse()){
    const p = byId(ch.id); if (!p) continue;
    if (ch.b === null) del.add(p.id);
    else Object.assign(p, ch.b);
  }
  if (del.size) S.products = S.products.filter(p => !del.has(p.id));
  if (b.source !== 'recalculo'){ const sup = supById(b.supId); if (sup) sup.lastListAt = b.prevListAt ?? null; }
  b.undone = true;
  invalidateIndex();
  save('products', 'history', 'suppliers');
}

/* ---------- listo ---------- */
function viewDone(){
  const b = S.history.find(h => h.id === ui.doneId);
  if (!b) return viewHome();
  const ids = b.changes.map(c => c.id).filter(id => byId(id));
  let h = topbar('Listo', 'home') + `<main class="wrap">`;
  if (b.undone){
    h += `<div class="done-hero"><div class="ok">${burst('var(--sky)', 16, 0.84)}${ic('back')}</div><h2>Deshiciste la lista</h2><p class="muted">Los precios volvieron a como estaban.</p></div><button class="btn block" data-a="home">Volver al inicio</button>`;
    return h + `</main>`;
  }
  h += `<div class="done-hero"><div class="ok">${burst('var(--lime)', 16, 0.84)}${ic('check')}</div><h2>${b.changes.length ? `Actualizaste ${b.changes.length} ${b.changes.length === 1 ? 'precio' : 'precios'}` : 'Tus precios ya estaban al día'}</h2><p class="muted">${esc(b.supName)} · ${batchLine(b)}</p></div>`;
  if (ids.length) h += `<button class="btn tagb block" data-a="labels" data-id="${b.id}">${ic('tag', 20)}Etiquetas de lo que cambió (${ids.length})</button>
    <button class="btn sec block" data-a="exportBatch" data-id="${b.id}">${ic('dl', 20)}Exportar cambios a Excel</button>`;
  h += `<div class="btns"><button class="btn sec" data-a="undo" data-id="${b.id}">Deshacer</button><button class="btn sec" data-a="home">Volver al inicio</button></div>`;
  return h + `</main>`;
}

/* ---------- importar catálogo ---------- */
function viewImport(){
  const m = ui.imp;
  const {rows, cols} = m;
  const ncol = Math.max(...rows.slice(0, 40).map(r => r.length));
  const hdr = cols.header >= 0 ? rows[cols.header] : [];
  const L = j => `Columna ${String.fromCharCode(65 + (j % 26))}${hdr[j] ? ': ' + String(hdr[j]).slice(0, 24) : ''}`;
  const sel = (k, label, opt) => `<label class="f" for="imp-${k}">${label}<select class="inp" id="imp-${k}" data-ch="impCol" data-k="${k}">${opt ? '<option value="-1">No tiene</option>' : ''}${Array.from({length: ncol}, (_, j) => `<option value="${j}" ${j === cols[k] ? 'selected' : ''}>${esc(L(j))}</option>`).join('')}</select></label>`;
  const items = importItems();
  let h = topbar('Importar catálogo', 'impBack') + `<main class="wrap">
    <p class="muted small">${esc(m.fileName)} · revisá qué columna tiene cada dato.</p>
    <div class="tbl-wrap"><table class="prev"><tbody>${rows.slice(Math.max(0, cols.header), Math.max(0, cols.header) + 6).map((r, ri) => `<tr>${Array.from({length: ncol}, (_, j) => `<${ri === 0 && cols.header >= 0 ? 'th' : 'td'}>${esc(String(r[j] ?? '').slice(0, 30))}</${ri === 0 && cols.header >= 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="card stack">${sel('desc', 'Producto')}${sel('code', 'Código', true)}${sel('cat', 'Categoría', true)}${sel('cost', 'Costo', true)}${sel('price', 'Precio de venta', true)}
      <label class="f" for="imp-sup">Proveedor<select class="inp" id="imp-sup" data-ch="impSup"><option value="">Varios o ninguno</option>${S.suppliers.map(s => `<option value="${s.id}" ${m.supId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      ${cols.cost >= 0 ? `<label class="toggle small"><span>Recalcular precios de venta con mi margen</span><input type="checkbox" data-ch="impRecalc" ${m.recalc ? 'checked' : ''}></label>` : ''}
    </div>
    ${items.length ? `<p class="small"><b>${items.length}</b> productos listos para importar${m.dupes ? `, ${m.dupes} ya existen y se actualizan` : ''}.</p>` : `<div class="warnbox">No encontramos productos con esas columnas. Probá eligiendo otras.</div>`}
    <button class="btn block" data-a="impGo" ${items.length ? '' : 'disabled'}>Importar ${items.length} productos</button>
  </main>`;
  return h;
}
function importItems(){
  const m = ui.imp, {rows, cols} = m; const out = [];
  let dupes = 0;
  const byCode = new Map(S.products.filter(p => p.code).map(p => [normCode(p.code), p]));
  const byName = new Map(S.products.map(p => [norm(p.name), p]));
  for (let i = cols.header + 1; i < rows.length; i++){
    const r = rows[i];
    const name = String(r[cols.desc] ?? '').trim();
    if (!name || !/[a-záéíóúñ]/i.test(name)) continue;
    const it = {name, code: cols.code >= 0 ? String(r[cols.code] ?? '').trim() : '', category: cols.cat >= 0 ? String(r[cols.cat] ?? '').trim() : '', cost: cols.cost >= 0 ? parseNum(r[cols.cost]) : NaN, price: cols.price >= 0 ? parseNum(r[cols.price]) : NaN};
    if (!(it.cost > 0) && !(it.price > 0)) continue;
    it.existing = (it.code && byCode.get(normCode(it.code))) || byName.get(norm(name)) || null;
    if (it.existing) dupes++;
    out.push(it);
  }
  m.dupes = dupes;
  return out;
}
function doImport(){
  const m = ui.imp; const items = importItems(); const now = Date.now();
  const cats = new Set((S.settings.categories || []).map(c => c.name));
  for (const it of items){
    if (it.category && !cats.has(it.category)){ S.settings.categories.push({name: it.category, margin: null, iva: null}); cats.add(it.category); }
    const p = it.existing || {id: newId(), name: it.name, code: '', category: '', supplierId: m.supId || null, cost: 0, price: 0, margin: null, updatedAt: now, priceAt: now};
    p.name = it.name; if (it.code) p.code = it.code; if (it.category) p.category = it.category; if (m.supId) p.supplierId = m.supId;
    if (it.cost > 0) p.cost = r2(it.cost);
    if (it.price > 0 && !m.recalc) p.price = r2(it.price);
    else if (p.cost > 0) p.price = priceFrom(p.cost, p);
    p.updatedAt = now;
    pushHist(p, now);
    if (!it.existing) S.products.push(p);
  }
  invalidateIndex();
  save('products', 'settings');
  ui.imp = null;
  toast(`Importaste ${items.length} productos.`);
  go('prices');
}
const SCREENS = {newlist: viewNewList, processing: viewProcessing, review: viewReview, done: viewDone, import: viewImport};

/* ============ hojas (paneles inferiores) ============ */
function renderSheet(){
  const el = $('#sheet');
  const s = ui.sheet;
  if (!s){ el.hidden = true; el.innerHTML = ''; return; }
  const body = (SHEETS[s.type] || (() => ''))(s);
  el.hidden = false;
  el.innerHTML = `<div class="bg" data-a="closeSheet"></div><div class="pane" role="dialog" aria-modal="true"><div class="grab"></div>${body}</div>`;
}
function sheetHead(title){ return `<div class="pane-h"><h2>${esc(title)}</h2><button class="x" data-a="closeSheet" aria-label="Cerrar">${ic('x', 20)}</button></div>`; }
function catOptions(sel){
  const cats = (S.settings.categories || []).map(c => c.name);
  return `<option value="">Sin categoría</option>${cats.map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new">+ Nueva categoría…</option>`;
}
const SHEETS = {
  product(s){
    const p = s.id ? byId(s.id) : {name: '', code: '', category: '', supplierId: '', cost: '', price: '', margin: null};
    if (!p) return '';
    const m = realMargin(p);
    return sheetHead(s.id ? 'Producto' : 'Nuevo producto') + `<div class="stack">
      <label class="f" for="p-name">Nombre<input class="inp" id="p-name" value="${esc(p.name)}" placeholder="Ej.: Yerba Playadito 1 kg"></label>
      <div class="grid2"><label class="f" for="p-code">Código<input class="inp" id="p-code" value="${esc(p.code)}"></label>
      <label class="f" for="p-cat">Categoría<select class="inp" id="p-cat" data-ch="catSel">${catOptions(p.category)}</select></label></div>
      <label class="f" for="p-sup">Proveedor<select class="inp" id="p-sup"><option value="">Ninguno</option>${S.suppliers.map(x => `<option value="${x.id}" ${x.id === p.supplierId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <div class="grid2"><label class="f" for="p-buy">El proveedor lo cobra por<select class="inp" id="p-buy" data-ch="pBuy">${[['u', 'Unidad'], ['pack', 'Bulto o caja'], ['kg', 'Kilo']].map(([v, l]) => `<option value="${v}" ${(p.buy?.type || 'u') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f" for="p-sell">Lo vendés por<select class="inp" id="p-sell" data-ch="pBuy">${[['u', 'Unidad'], ['kg', 'Kilo'], ['100g', '100 g']].map(([v, l]) => `<option value="${v}" ${(p.sell || 'u') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label class="f" for="p-bn" id="p-bn-w" ${p.buy?.type === 'pack' ? '' : 'hidden'}>Unidades por bulto<input class="inp num" id="p-bn" inputmode="numeric" value="${esc(p.buy?.n || '')}" placeholder="Ej.: 12"></label>
      <p class="tiny">Se usa al leer las próximas listas: el precio del bulto se divide por las unidades, y el del kilo por 10 si vendés por 100 g.</p>
      <div class="grid2"><label class="f" for="p-cost">Costo ${p.sell === 'kg' ? 'por kilo' : p.sell === '100g' ? 'por 100 g' : 'por unidad'}<div class="inp-pre"><input class="inp num" id="p-cost" inputmode="decimal" value="${p.cost ? esc(String(p.cost).replace('.', ',')) : ''}" data-in="pCalc"><b>$</b></div></label>
      <label class="f" for="p-margin">Margen<div class="inp-suf"><input class="inp num" id="p-margin" inputmode="decimal" value="${hasVal(p.margin) ? esc(p.margin) : ''}" placeholder="${NF1.format(marginFor({category: p.category}))}" data-in="pCalc"><b>%</b></div></label></div>
      <label class="f" for="p-price">Precio de venta<div class="inp-pre"><input class="inp num" id="p-price" inputmode="decimal" value="${p.price ? esc(String(p.price).replace('.', ',')) : ''}" data-in="pManual"><b>$</b></div></label>
      <p class="tiny" id="p-info">${p.cost > 0 && p.price > 0 ? `Ganancia por unidad: ${costTxt(p.price - p.cost)} (${m != null ? NF1.format(m) + ' %' : '—'})` : 'Si cargás el costo, el precio se calcula con tu margen.'}</p>
      <label class="toggle small"><span>Precio fijo: las listas actualizan el costo pero no el precio de venta</span><input type="checkbox" id="p-lock" ${p.lock ? 'checked' : ''}></label>
      ${s.id ? `<p class="tiny">Precio actualizado ${ago(p.priceAt)} · costo revisado ${ago(p.checkedAt || p.updatedAt)}</p>` : ''}
      ${s.id && (p.hist || []).length > 1 ? histHTML(p) : ''}
      <button class="btn block" data-a="pSave">Guardar</button>
      ${s.id ? (s.del ? `<div class="errbox stack"><span>¿Eliminar ${esc(p.name)}?</span><div class="btns"><button class="btn sm danger" data-a="pDelYes">Eliminar</button><button class="btn sm sec" data-a="pDelNo">Cancelar</button></div></div>` : `<div class="btns"><button class="btn sm sec" data-a="labelsOne">${ic('tag', 18)}Etiqueta</button><button class="btn sm ghost" data-a="pDel">Eliminar producto</button></div>`) : ''}
    </div>`;
  },
  supplier(s){
    const x = s.id ? supById(s.id) : {name: '', ivaIncluded: false, discount: '', aiHint: ''};
    if (!x) return '';
    const learned = s.id ? Object.values(S.maps[s.id] || {}) : [];
    return sheetHead(s.id ? x.name : 'Nuevo proveedor') + `<div class="stack">
      <label class="f" for="s-name">Nombre<input class="inp" id="s-name" value="${esc(x.name)}"></label>
      <label class="toggle"><span>Los precios de su lista <b>incluyen IVA</b></span><input type="checkbox" id="s-iva" ${x.ivaIncluded ? 'checked' : ''}></label>
      <label class="f" for="s-disc">Bonificación o descuento que te hace<div class="inp-suf"><input class="inp num" id="s-disc" inputmode="decimal" value="${esc(x.discount || '')}" placeholder="0"><b>%</b></div></label>
      <label class="f" for="s-hint">Indicaciones para leer su lista<textarea class="inp" id="s-hint" rows="2" placeholder="Ej.: usar la columna 'Precio x unidad', no la de bulto">${esc(x.aiHint || '')}</textarea></label>
      ${s.id ? `<p class="tiny">${learned.filter(v => v !== '-').length} productos vinculados y ${learned.filter(v => v === '-').length} marcados como "no lo vendo". Remarcá los recuerda en cada lista.</p>` : ''}
      <button class="btn block" data-a="sSave">Guardar</button>
      ${s.id ? `<div class="btns"><button class="btn sm sec" data-a="newlistSup" data-id="${x.id}">Cargar lista nueva</button>${learned.length ? `<button class="btn sm ghost" data-a="sForget">Olvidar vinculaciones</button>` : ''}</div>
      ${s.del ? `<div class="errbox stack"><span>¿Eliminar a ${esc(x.name)}? Sus productos quedan en tu catálogo.</span><div class="btns"><button class="btn sm danger" data-a="sDelYes">Eliminar</button><button class="btn sm sec" data-a="sDelNo">Cancelar</button></div></div>` : `<button class="btn sm ghost" data-a="sDel">Eliminar proveedor</button>`}` : ''}
    </div>`;
  },
  rvItem(s){
    const R = ui.review, sup = supById(R.supId); const it = R.items[s.i]; const c = calcItem(it, R, sup);
    const ivaInc = R.ivaOverride ?? !!sup.ivaIncluded;
    const cat = c.p ? c.p.category : (it.newCat || R.newCat);
    return sheetHead(c.p ? c.p.name : tidyName(it.desc)) + `<div class="stack">
      <div class="card flat" style="padding:12px">
        <div class="kv"><span>En la lista</span><b style="text-align:right">${esc(it.desc)}</b></div>
        ${it.code ? `<div class="kv"><span>Código</span><b>${esc(it.code)}</b></div>` : ''}
        <div class="kv"><span>Precio de lista</span><b>${costTxt(+it.listed)} ${ivaInc ? 'con IVA' : 'sin IVA'}</b></div>
        ${c.pack > 1 ? `<div class="kv"><span>÷ ${c.pack} unidades de venta</span><b>${costTxt(+it.listed / c.pack)}</b></div>` : ''}
        ${!ivaInc ? `<div class="kv"><span>+ IVA ${NF1.format(ivaFor(cat))} %</span><b></b></div>` : ''}
        ${+sup.discount ? `<div class="kv"><span>− bonificación ${NF1.format(sup.discount)} %</span><b></b></div>` : ''}
        <div class="kv"><span>Costo para vos</span><b>${costTxt(c.nc)}</b></div>
        ${c.oc != null ? `<div class="kv"><span>Costo anterior</span><b>${costTxt(c.oc)}${c.pct != null ? ` (${pctTxt(c.pct)})` : ''}</b></div>` : ''}
        ${c.op != null ? `<div class="kv"><span>Precio de venta actual</span><b>$ ${priceTxt(c.op)}</b></div>` : ''}
      </div>
      <label class="f" for="rv-pack">¿Cuántas unidades de venta trae ese precio?<input class="inp num" id="rv-pack" inputmode="numeric" value="${c.pack}"></label>
      <p class="tiny">Poné 12 si el precio es por una caja de 12 y vos vendés por unidad. Remarcá lo recuerda para las próximas listas.</p>
      ${c.lock ? '<div class="warnbox">Este producto tiene precio fijo: se actualiza el costo pero el precio de venta no cambia, salvo que escribas uno nuevo.</div>' : ''}
      ${c.st === 'new' ? `<label class="f" for="rv-cat">Categoría<select class="inp" id="rv-cat" data-ch="catSel">${catOptions(it.newCat || R.newCat)}</select></label>` : ''}
      <label class="f" for="rv-price">Precio de venta nuevo<div class="inp-pre"><input class="inp num" id="rv-price" inputmode="decimal" placeholder="${priceTxt(priceFrom(c.nc, c.p || {category: cat}))}" value="${hasVal(it.override) ? esc(String(it.override).replace('.', ',')) : ''}"><b>$</b></div></label>
      <p class="tiny">Vacío = se calcula con el margen (${NF1.format(marginFor(c.p || {category: cat}))} %).</p>
      <label class="toggle"><span>${c.st === 'new' ? 'Agregar a mi catálogo' : 'Aplicar este cambio'}</span><input type="checkbox" id="rv-inc" ${it.include ? 'checked' : ''}></label>
      <button class="btn block" data-a="rvSave" data-i="${s.i}">Listo</button>
      <div class="btns"><button class="btn sm sec" data-a="rvPick" data-i="${s.i}">${c.p ? 'Es otro producto' : 'Ya lo tengo en el catálogo'}</button>${c.p ? `<button class="btn sm sec" data-a="rvNew" data-i="${s.i}">Es un producto nuevo</button>` : `<button class="btn sm ghost" data-a="rvIgnore" data-i="${s.i}">No lo vendo</button>`}</div>
    </div>`;
  },
  pick(s){
    const R = ui.review; const it = R.items[s.i];
    return sheetHead('¿Qué producto es?') + `<div class="stack"><p class="small muted">En la lista: <b>${esc(it.desc)}</b></p>
      <div class="inp-pre"><input class="inp" id="pick-q" type="search" placeholder="Buscar en tu catálogo" value="${esc(s.q || '')}" data-in="pickQ" autocomplete="off"><b>${ic('search', 18)}</b></div>
      <div id="pick-list">${pickList(s)}</div></div>`;
  },
  batch(s){
    const b = S.history.find(h => h.id === s.id); if (!b) return '';
    const can = lastUndoable()?.id === b.id;
    const rows = b.changes.slice(0, 60).map(ch => { const p = byId(ch.id); const name = p ? p.name : 'Producto eliminado'; return `<div class="li"><span class="grow"><span class="t">${esc(name)}</span><span class="s">${ch.b ? `Costo ${costTxt(ch.b.cost)} → ${costTxt(ch.a.cost)}` : 'Agregado al catálogo'}</span></span><span class="r">${ch.b ? `<span class="old">$ ${priceTxt(ch.b.price)}</span>` : ''}${moneyHTML(ch.a.price)}</span></div>`; }).join('');
    return sheetHead(b.supName) + `<div class="stack"><p class="muted small">${fmtDate(b.at)} · ${batchLine(b)}${b.file ? ' · ' + esc(b.file) : ''}${b.undone ? ' · <b>deshecha</b>' : ''}</p>
      ${!b.undone && b.changes.length ? `<div class="btns"><button class="btn sm tagb" data-a="labels" data-id="${b.id}">${ic('tag', 18)}Etiquetas</button><button class="btn sm sec" data-a="exportBatch" data-id="${b.id}">${ic('dl', 18)}Excel</button>${can ? `<button class="btn sm sec" data-a="undo" data-id="${b.id}">Deshacer</button>` : ''}</div>` : ''}
      ${!b.undone && !can ? '<p class="tiny">Solo se puede deshacer la última lista aplicada.</p>' : ''}
      ${rows ? `<div class="list">${rows}</div>` : '<p class="muted">Esta lista no cambió precios.</p>'}${b.changes.length > 60 ? `<p class="tiny">Y ${b.changes.length - 60} más.</p>` : ''}</div>`;
  },
  labels(s){
    const n = s.ids.length;
    const sizes = [['s', 'Chicas', '40 por hoja'], ['m', 'Medianas', '24 por hoja'], ['g', 'Grandes', '10 por hoja']];
    return sheetHead('Etiquetas de precio') + `<div class="stack"><p class="muted">${n} ${n === 1 ? 'etiqueta' : 'etiquetas'} en hojas A4, listas para imprimir y recortar.</p>
      <div class="seg">${sizes.map(([v, l, d]) => `<button class="${s.size === v ? 'on' : ''}" data-a="lblSize" data-v="${v}">${l} · ${d}</button>`).join('')}</div>
      <label class="toggle small"><span>Mostrar el nombre del comercio</span><input type="checkbox" id="lbl-store" ${s.store !== false ? 'checked' : ''}></label>
      <button class="btn tagb block" data-a="lblGo">${ic('dl', 20)}Descargar PDF</button></div>`;
  }
};
function histHTML(p){
  const h = p.hist.slice(-8);
  const max = Math.max(...h.map(x => x[1]), 1), min = Math.min(...h.map(x => x[1]));
  const W = 280, H = 56, pad = 6;
  const X = i => pad + (h.length === 1 ? 0 : i * (W - 2 * pad) / (h.length - 1));
  const Y = v => max === min ? H / 2 : H - pad - (v - min) / (max - min) * (H - 2 * pad);
  const pts = h.map((x, i) => `${X(i).toFixed(1)},${Y(x[1]).toFixed(1)}`).join(' ');
  const first = h[0][1], last = h[h.length - 1][1];
  const rows = h.slice().reverse().map((x, i, arr) => { const prev = arr[i + 1]; const d = prev && prev[1] > 0 ? (x[1] / prev[1] - 1) * 100 : null; return `<div class="kv"><span>${fmtDate(x[0])}</span><span class="num">costo ${costTxt(x[1])}${d != null && Math.abs(d) >= 0.05 ? ` <span class="chip ${d > 0 ? 'up' : 'down'}">${pctTxt(d)}</span>` : ''}</span><b>$ ${priceTxt(x[2])}</b></div>`; }).join('');
  return `<div class="card flat stack" style="padding:12px"><div class="row"><b class="grow">Historial de costos</b>${first > 0 ? `<span class="chip ${last >= first ? 'up' : 'down'}">${pctTxt((last / first - 1) * 100)}</span>` : ''}</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Evolución del costo"><polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${h.map((x, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(x[1]).toFixed(1)}" r="${i === h.length - 1 ? 4 : 2.5}" fill="${i === h.length - 1 ? 'var(--tag)' : 'var(--ink)'}" stroke="var(--ink)" stroke-width="1"/>`).join('')}</svg>
    <div>${rows}</div></div>`;
}
function pickList(s){
  const R = ui.review; const it = R.items[s.i];
  let ids;
  if (s.q && s.q.trim()){ const qs = norm(s.q).split(' ').filter(Boolean); ids = S.products.filter(p => { const h = norm(p.name + ' ' + p.code); return qs.every(q => h.includes(q)); }).slice(0, 40).map(p => p.id); }
  else ids = (it.cands.length ? it.cands : candidates(it.desc, R.supId, 8).map(c => c.id));
  if (!ids.length) return `<p class="muted small">No hay productos parecidos. Buscalo por nombre o código.</p>`;
  return `<div class="list">${ids.map(id => { const p = byId(id); if (!p) return ''; return `<button class="li" data-a="pickSet" data-id="${id}"><span class="grow"><span class="t">${esc(p.name)}</span><span class="s">${esc([p.category, p.code && 'cód. ' + p.code].filter(Boolean).join(' · ') || ' ')}</span></span>${moneyHTML(p.price)}</button>`; }).join('')}</div>`;
}

/* ============ archivos de salida ============ */
async function saveFile(filename, blob){
  const dl = await capUse('downloads');
  if (!dl){ toast('Para descargar archivos, abrí Remarcá desde tu cuenta de Claude.'); return false; }
  try { const r = await dl.save({filename, data: blob}); if (r?.status === 'saved') toast('Listo: ' + filename); return true; }
  catch (e) {
    if (e?.code === 'declined') return false;
    if (e?.code === 'rate_limited'){ toast('Ya hay una descarga esperando tu confirmación.'); return false; }
    toast('No se pudo guardar el archivo en este dispositivo.'); return false;
  }
}
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fileSafe = s => String(s || 'comercio').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
async function exportXlsx(sheetName, rows, filename, widths){
  try { await loadLib('xlsx'); } catch (e) { toast(e.message); return; }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(w => ({wch: w}));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
  await saveFile(filename, new Blob([out], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
}
function exportPrices(){
  const arr = filteredProducts();
  const rows = [['Código', 'Producto', 'Categoría', 'Proveedor', 'Se vende por', 'Costo', 'Margen %', 'Precio de venta', 'Precio actualizado']];
  for (const p of arr) rows.push([p.code || '', p.name, p.category || '', supById(p.supplierId)?.name || '', {u: 'unidad', kg: 'kilo', '100g': '100 g'}[p.sell || 'u'], p.cost || null, realMargin(p) != null ? r2(realMargin(p)) : null, p.price, p.priceAt ? fmtDate(p.priceAt) : '']);
  exportXlsx('Precios', rows, `precios-${fileSafe(S.settings.store)}-${stamp()}.xlsx`, [12, 40, 16, 22, 12, 12, 10, 16, 16]);
}
function exportBatch(id){
  const b = S.history.find(h => h.id === id); if (!b) return;
  const rows = [['Código', 'Producto', 'Costo anterior', 'Costo nuevo', 'Precio anterior', 'Precio nuevo', 'Variación %']];
  for (const ch of b.changes){ const p = byId(ch.id); if (!p) continue; rows.push([p.code || '', p.name, ch.b ? ch.b.cost : null, ch.a.cost, ch.b ? ch.b.price : null, ch.a.price, ch.b && ch.b.price ? r2((ch.a.price / ch.b.price - 1) * 100) : null]); }
  exportXlsx('Cambios', rows, `cambios-${fileSafe(b.supName)}-${stamp()}.xlsx`, [12, 40, 14, 14, 14, 14, 12]);
}
async function makeLabels(ids, size, withStore){
  try { await loadLib('jspdf'); } catch (e) { toast(e.message); return; }
  const prods = ids.map(byId).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!prods.length) return;
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit: 'mm', format: 'a4'});
  const L = {s: {cols: 4, rows: 10, price: 22, name: 7.5, foot: 5.5}, m: {cols: 3, rows: 8, price: 30, name: 9, foot: 6.5}, g: {cols: 2, rows: 5, price: 50, name: 13, foot: 8}}[size] || {cols: 3, rows: 8, price: 30, name: 9, foot: 6.5};
  const mx = 8, my = 8, W = (210 - 2 * mx) / L.cols, H = (297 - 2 * my) / L.rows, pad = 2.6, pt = 0.3528;
  const date = fmtDate(Date.now());
  prods.forEach((p, i) => {
    const k = i % (L.cols * L.rows);
    if (i && !k) doc.addPage();
    const x = mx + (k % L.cols) * W, y = my + Math.floor(k / L.cols) * H;
    doc.setDrawColor(200); doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.2); doc.rect(x, y, W, H);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(L.name);
    const lines = doc.splitTextToSize(p.name, W - 2 * pad).slice(0, 2);
    doc.text(lines, x + pad, y + pad + L.name * pt);
    if (unitTxt(p)){ doc.setFont('helvetica', 'normal'); doc.setFontSize(L.name * 0.85); doc.text(unitTxt(p), x + pad, y + pad + L.name * pt * (lines.length + 1) + 0.8); doc.setFont('helvetica', 'bold'); }
    // precio
    const txt = priceTxt(p.price);
    let fs = L.price;
    doc.setFontSize(fs);
    while (doc.getTextWidth(txt) + 6 > W - 2 * pad && fs > 10){ fs -= 1; doc.setFontSize(fs); }
    const py = y + H - pad - L.foot * pt - 1.2;
    doc.text(txt, x + W - pad, py, {align: 'right'});
    const tw = doc.getTextWidth(txt);
    doc.setFontSize(fs * 0.5); doc.text('$', x + W - pad - tw - 1, py - fs * pt * 0.38, {align: 'right'});
    doc.setFont('helvetica', 'normal'); doc.setFontSize(L.foot); doc.setTextColor(90, 90, 90);
    doc.text([date, withStore ? S.settings.store : ''].filter(Boolean).join(' · ').slice(0, 60), x + pad, y + H - pad);
    if (p.code) doc.text(String(p.code).slice(0, 16), x + W - pad, y + H - pad, {align: 'right'});
  });
  const blob = doc.output('blob');
  await saveFile(`etiquetas-${fileSafe(S.settings.store)}-${stamp()}.pdf`, blob);
}

/* ============ recalcular ============ */
function recalcAll(){
  const now = Date.now(); const changes = [];
  for (const p of S.products){
    if (!(p.cost > 0) || p.lock) continue;
    const np = priceFrom(p.cost, p);
    if (Math.abs(np - p.price) > 0.004){ changes.push({id: p.id, b: {cost: p.cost, price: p.price, updatedAt: p.updatedAt || null, priceAt: p.priceAt || null, supplierId: p.supplierId || null, checkedAt: p.checkedAt || null, hist: (p.hist || []).slice()}, a: {cost: p.cost, price: np}}); p.price = np; p.priceAt = now; pushHist(p, now); }
  }
  if (!changes.length) return;
  const up = changes.filter(c => c.a.price > c.b.price).length;
  const b = {id: newId(), at: now, supId: null, supName: 'Recálculo con márgenes', source: 'recalculo', file: '', counts: {up, down: changes.length - up, new: 0}, changes, undone: false};
  S.history.unshift(b); if (S.history.length > 25) S.history.length = 25;
  save('products', 'history');
  ui.doneId = b.id; screen('done');
}

/* ============ toasts ============ */
function toast(msg, action){
  const box = $('#toast');
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<span class="grow">${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { t.remove(); action.fn(); };
  box.appendChild(t);
  setTimeout(() => t.remove(), action ? 7000 : 3800);
}

/* ============ selección de archivos ============ */
function pickFile(accept, opts = {}){
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.hidden = true;
    if (opts.capture) inp.setAttribute('capture', 'environment');
    if (opts.multiple) inp.multiple = true;
    inp.onchange = () => { res(inp.files ? [...inp.files] : []); inp.remove(); };
    document.body.appendChild(inp); inp.click();
  });
}
