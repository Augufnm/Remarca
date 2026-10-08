/* ============ datos de ejemplo ============ */
const DEMO_LIST = `DISTRIBUIDORA DEL SUR
LISTA DE PRECIOS MAYORISTA - VIGENCIA OCTUBRE
Precios sin IVA. Condición: contado.

COD    DESCRIPCION                              PRECIO
1021   YERBA PLAYADITO 1KG                      $ 3.950,00
1022   YERBA TARAGUI 500GR                      $ 1.890,00
1040   AZUCAR LEDESMA 1KG                       $ 990,00
1055   ARROZ GALLO ORO 1KG                      $ 1.600,00
1060   FIDEOS MATARAZZO SPAGHETTI 500GR         $ 1.310,00
1061   FIDEOS LUCCHETTI TIRABUZON 500GR         $ 1.050,00
       ACEITE NATURA GIRASOL 1.5LT              $ 2.890,00
1090   HARINA PUREZA 0000 1KG                   $ 880,00
1101   CAFE LA VIRGINIA 500GR                   $ 8.100,00
1120   GALLETITAS OREO 118GR                    $ 990,00
       DDL SERENISIMA CLASICO 400G              $ 2.240,00
1150   PURE DE TOMATE ARCOR 520GR               $ 760,00
1160   LECHE EN POLVO NIDO 800GR                $ 10.400,00
1170   TE TARAGUI 25 SAQUITOS                   $ 710,00
1190   GALLETITAS TERRABUSI VARIEDAD 400GR      $ 1.650,00
1195   ACEITE DE OLIVA COCINERO 500ML           $ 5.900,00
1200   YERBA PLAYADITO 500GR                    $ 2.050,00
1210   ALFAJOR JORGITO CHOCOLATE CAJA X 6       $ 4.200,00
1220   QUESO CREMOSO LA PAULINA X KG            $ 6.900,00`;
function seedDemo(){
  const now = Date.now(), day = 86400000;
  S.settings = {...DEFAULT_SETTINGS(), store: 'Almacén Don Tito', demo: true, categories: [
    {name: 'Almacén', margin: null, iva: null}, {name: 'Desayuno', margin: 45, iva: null}, {name: 'Bebidas', margin: 35, iva: null}, {name: 'Limpieza', margin: 38, iva: null}, {name: 'Perfumería', margin: 45, iva: null}]};
  const sur = {id: 'sup_sur', name: 'Distribuidora del Sur', ivaIncluded: false, discount: 0, lastListAt: now - 41 * day, lists: 3, aiHint: ''};
  const cen = {id: 'sup_cen', name: 'Mayorista Central', ivaIncluded: true, discount: 5, lastListAt: now - 9 * day, lists: 5, aiHint: ''};
  S.suppliers = [sur, cen];
  const P = [
    [sur, '1021', 'Yerba Playadito 1 kg', 'Desayuno', 3500], [sur, '1022', 'Yerba Taragüí 500 g', 'Desayuno', 1700],
    [sur, '1040', 'Azúcar Ledesma 1 kg', 'Almacén', 950], [sur, '1055', 'Arroz Gallo Oro 1 kg', 'Almacén', 1600],
    [sur, '1060', 'Fideos Matarazzo Spaghetti 500 g', 'Almacén', 1200], [sur, '1061', 'Fideos Lucchetti Tirabuzón 500 g', 'Almacén', 980],
    [sur, '', 'Aceite Natura Girasol 1,5 l', 'Almacén', 3100], [sur, '1090', 'Harina Pureza 0000 1 kg', 'Almacén', 820],
    [sur, '1101', 'Café La Virginia 500 g', 'Desayuno', 6200], [sur, '1120', 'Galletitas Oreo 118 g', 'Desayuno', 900],
    [sur, '', 'Dulce de leche La Serenísima 400 g', 'Desayuno', 2100], [sur, '1140', 'Mermelada Arcor Durazno 454 g', 'Desayuno', 1500],
    [sur, '1150', 'Puré de tomate Arcor 520 g', 'Almacén', 700], [sur, '1160', 'Leche en polvo Nido 800 g', 'Desayuno', 9800],
    [sur, '1170', 'Té Taragüí 25 saquitos', 'Desayuno', 650],
    [sur, '1210', 'Alfajor Jorgito chocolate', 'Desayuno', 3800 / 6], [sur, '1220', 'Queso cremoso La Paulina', 'Almacén', 6200],
    [cen, 'MC204', 'Coca-Cola 2,25 l', 'Bebidas', 3300], [cen, 'MC210', 'Agua Villavicencio 2 l', 'Bebidas', 1250],
    [cen, 'MC233', 'Fernet Branca 750 ml', 'Bebidas', 11800], [cen, 'MC240', 'Cerveza Quilmes 1 l', 'Bebidas', 2100],
    [cen, 'MC310', 'Detergente Magistral 500 ml', 'Limpieza', 2350], [cen, 'MC318', 'Lavandina Ayudín 1 l', 'Limpieza', 1100],
    [cen, 'MC402', 'Papel higiénico Higienol 4 u', 'Limpieza', 2600], [cen, 'MC415', 'Jabón Dove 90 g', 'Perfumería', 1450],
    [cen, 'MC420', 'Shampoo Sedal 340 ml', 'Perfumería', 3700], [cen, 'MC501', 'Pilas Duracell AA x 2', 'Almacén', 3900]
  ];
  S.products = P.map(([s, code, name, cat, lp]) => {
    const cost = costFromList(lp, s, cat);
    const p = {id: newId(), code, name, category: cat, supplierId: s.id, cost, price: 0, margin: null, updatedAt: s.lastListAt, priceAt: s.lastListAt, checkedAt: s.lastListAt};
    p.price = priceFrom(cost, p);
    // historial: dos listas anteriores con costos algo más bajos
    p.hist = [[s.lastListAt - 70 * day, r2(cost / 1.11), roundPrice(cost / 1.11 * (1 + marginFor(p) / 100))], [s.lastListAt - 35 * day, r2(cost / 1.05), roundPrice(cost / 1.05 * (1 + marginFor(p) / 100))], [s.lastListAt, cost, p.price]];
    p.buy = {type: 'u'}; p.sell = 'u';
    return p;
  });
  const alf = S.products.find(p => p.code === '1210'); alf.buy = {type: 'pack', n: 6};
  const queso = S.products.find(p => p.code === '1220'); queso.buy = {type: 'kg'}; queso.sell = 'kg';
  const fernet = S.products.find(p => p.code === 'MC233');
  fernet.cost = r2(fernet.cost * 1.18); fernet.price = roundPrice(fernet.cost * 0.97); fernet.updatedAt = now - 2 * day;
  S.maps = {}; S.history = [];
  invalidateIndex();
  save(...SECTIONS);
}

/* ============ acciones ============ */
const A = {
  tab: el => go(el.dataset.v),
  home: () => { ui.screen = null; ui.tab = 'home'; ui.sheet = null; render(); window.scrollTo(0, 0); },
  closeSheet: () => { ui.sheet = null; renderSheet(); },
  newlist: () => { ui.nl = {supId: S.suppliers.length === 1 ? S.suppliers[0].id : null, photos: [], mode: null, text: ''}; screen('newlist'); },
  newlistSup: el => { ui.nl = {supId: el.dataset.id, photos: [], mode: null, text: ''}; screen('newlist'); },

  /* onboarding */
  obMargin: el => { $('#ob-margin').value = el.dataset.v; },
  obRound: el => { ui.obRound = +el.dataset.v; document.querySelectorAll('#ob-round button').forEach(b => b.classList.toggle('on', b === el)); },
  obStart: () => {
    const store = $('#ob-store').value.trim();
    const margin = parseNum($('#ob-margin').value);
    if (!store){ $('#ob-store').focus(); toast('Escribí el nombre del comercio.'); return; }
    if (!(margin >= 0) || margin > 1000){ $('#ob-margin').focus(); toast('Revisá el margen: tiene que ser un número, por ejemplo 40.'); return; }
    S.settings = {...DEFAULT_SETTINGS(), store, margin, round: ui.obRound ?? 10};
    save('settings'); ui.tab = 'home'; render();
  },
  demo: () => { seedDemo(); ui.tab = 'home'; render(); toast('Cargamos un almacén de ejemplo.'); },
  wipeDemo: () => { for (const k of SECTIONS){ S[k] = k === 'settings' ? null : k === 'maps' ? {} : []; } invalidateIndex(); save(...SECTIONS); ui.screen = null; render(); },
  demoList: () => { const sur = supById('sup_sur'); if (!sur) return; ui.nl = {supId: sur.id, photos: [], mode: 'text', text: DEMO_LIST}; runPipeline('text', {text: DEMO_LIST}); },

  /* precios */
  seeLoss: () => { ui.filter = 'loss'; ui.q = ''; go('prices'); },
  pfilter: el => { ui.filter = ui.filter === el.dataset.v ? 'all' : el.dataset.v; ui.plimit = 150; render(); },
  moreP: () => { ui.plimit += 150; $('#plist').innerHTML = priceListHTML(); },
  product: el => { ui.sheet = {type: 'product', id: el.dataset.id}; renderSheet(); },
  newProduct: () => { ui.sheet = {type: 'product', id: null}; renderSheet(); setTimeout(() => $('#p-name')?.focus(), 50); },
  selStart: () => { ui.select = true; ui.selected = new Set(); render(); },
  selCancel: () => { ui.select = false; ui.selected.clear(); render(); },
  selAll: () => { for (const p of filteredProducts()) ui.selected.add(p.id); render(); },
  selToggle: el => { const id = el.dataset.id; ui.selected.has(id) ? ui.selected.delete(id) : ui.selected.add(id); render(); },
  selToggleRow: el => A.selToggle(el),
  selLabels: () => { ui.sheet = {type: 'labels', ids: [...ui.selected], size: 'm'}; renderSheet(); },
  exportPrices: () => exportPrices(),
  labelsOne: () => { const id = ui.sheet.id; ui.sheet = {type: 'labels', ids: [id], size: 'g'}; renderSheet(); },
  pSave: () => {
    const s = ui.sheet; const name = $('#p-name').value.trim();
    if (!name){ $('#p-name').focus(); toast('Escribí el nombre del producto.'); return; }
    const cost = parseNum($('#p-cost').value), price = parseNum($('#p-price').value), mg = $('#p-margin').value.trim();
    const p = s.id ? byId(s.id) : {id: newId(), updatedAt: Date.now()};
    const oldPrice = p.price;
    p.name = name; p.code = $('#p-code').value.trim(); p.category = $('#p-cat').value === '__new' ? '' : $('#p-cat').value; p.supplierId = $('#p-sup').value || null;
    p.margin = mg === '' ? null : parseNum(mg);
    if (!isFinite(p.margin)) p.margin = null;
    const bt = $('#p-buy').value, bn = Math.round(parseNum($('#p-bn').value));
    p.buy = bt === 'pack' ? {type: 'pack', n: bn > 1 ? bn : 1} : {type: bt};
    p.sell = $('#p-sell').value; p.lock = $('#p-lock').checked;
    const oldCost = p.cost;
    p.cost = cost > 0 ? r2(cost) : 0;
    p.price = price > 0 ? r2(price) : (p.cost ? priceFrom(p.cost, p) : 0);
    if (p.price !== oldPrice) p.priceAt = Date.now();
    if (p.price !== oldPrice || p.cost !== oldCost) pushHist(p, Date.now());
    p.updatedAt = Date.now();
    if (!s.id) S.products.push(p);
    invalidateIndex(); save('products');
    ui.sheet = null; render(); toast(s.id ? 'Producto guardado.' : 'Producto agregado.');
  },
  pDel: () => { ui.sheet.del = true; renderSheet(); },
  pDelNo: () => { ui.sheet.del = false; renderSheet(); },
  pDelYes: () => { const id = ui.sheet.id; S.products = S.products.filter(p => p.id !== id); for (const m of Object.values(S.maps)) for (const k in m) if (m[k] === id) delete m[k]; invalidateIndex(); save('products', 'maps'); ui.sheet = null; render(); toast('Producto eliminado.'); },
  catCreate: el => {
    const sel = document.getElementById(el.dataset.for); const inp = document.getElementById('catnew-' + el.dataset.for);
    const name = inp.value.trim(); if (!name){ inp.focus(); return; }
    if (!catOf(name)){ S.settings.categories.push({name, margin: null, iva: null}); save('settings'); }
    sel.innerHTML = catOptions(name); el.parentElement.remove();
    if (sel.id === 'rv-cat'){ const it = ui.review.items[ui.sheet.i]; it.newCat = name; }
  },

  /* importar */
  importCat: async () => {
    const [f] = await pickFile('.xlsx,.xls,.csv,.ods,text/csv');
    if (!f) return;
    try {
      const rows = await readSheetRows(f);
      if (!rows.length) throw new UserErr('La planilla está vacía.');
      const cols = guessCols(rows, true);
      if (cols.desc < 0) cols.desc = 0;
      ui.imp = {rows, cols, fileName: f.name, recalc: false, supId: ''};
      screen('import');
    } catch (e) { toast(e instanceof UserErr ? e.message : 'No se pudo abrir ese archivo. Usá un Excel (.xlsx) o CSV.'); }
  },
  impBack: () => { ui.imp = null; ui.screen = null; render(); },
  impGo: () => doImport(),

  /* proveedores */
  supplier: el => { ui.sheet = {type: 'supplier', id: el.dataset.id}; renderSheet(); },
  newSupplier: () => { ui.sheet = {type: 'supplier', id: null}; renderSheet(); setTimeout(() => $('#s-name')?.focus(), 50); },
  sSave: () => {
    const s = ui.sheet; const name = $('#s-name').value.trim();
    if (!name){ $('#s-name').focus(); toast('Escribí el nombre del proveedor.'); return; }
    const x = s.id ? supById(s.id) : {id: newId(), lastListAt: null, lists: 0};
    x.name = name; x.ivaIncluded = $('#s-iva').checked; const d = parseNum($('#s-disc').value); x.discount = d > 0 && d < 100 ? d : 0; x.aiHint = $('#s-hint').value.trim();
    if (!s.id) S.suppliers.push(x);
    save('suppliers'); ui.sheet = null; render(); toast('Proveedor guardado.');
  },
  sForget: () => { delete S.maps[ui.sheet.id]; const x = supById(ui.sheet.id); if (x) delete x.cols; save('maps', 'suppliers'); renderSheet(); toast('Vinculaciones olvidadas.'); },
  sDel: () => { ui.sheet.del = true; renderSheet(); },
  sDelNo: () => { ui.sheet.del = false; renderSheet(); },
  sDelYes: () => { const id = ui.sheet.id; S.suppliers = S.suppliers.filter(s => s.id !== id); delete S.maps[id]; for (const p of S.products) if (p.supplierId === id) p.supplierId = null; save('suppliers', 'maps', 'products'); ui.sheet = null; render(); },

  /* ajustes */
  setRound: el => { S.settings.round = +el.dataset.v; save('settings'); render(); },
  setEnding: el => { S.settings.ending = el.dataset.v; save('settings'); render(); },
  setRoundMode: el => { S.settings.roundMode = el.dataset.v; save('settings'); render(); },
  recalc: () => recalcAll(),
  addCat: () => { const inp = $('#newcat'); const name = inp.value.trim(); if (!name) { inp.focus(); return; } if (catOf(name)){ toast('Esa categoría ya existe.'); return; } S.settings.categories.push({name, margin: null, iva: null}); save('settings'); render(); },
  delCat: el => { const c = S.settings.categories[+el.dataset.i]; S.settings.categories.splice(+el.dataset.i, 1); save('settings'); render(); toast(`Quitaste ${c.name}. Sus productos usan el margen general.`); },
  backup: () => saveFile(`remarca-copia-${stamp()}.json`, new Blob([JSON.stringify({app: 'remarca', v: 1, at: Date.now(), data: S})], {type: 'application/json'})),
  restore: async () => {
    const [f] = await pickFile('.json,application/json'); if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j?.app !== 'remarca' || !j.data?.settings) throw 0;
      for (const k of SECTIONS) S[k] = j.data[k] ?? (k === 'maps' ? {} : []);
      invalidateIndex(); save(...SECTIONS); render(); toast('Copia restaurada.');
    } catch { toast('Ese archivo no es una copia de Remarcá.'); }
  },
  wipe: () => { ui.wipe = true; render(); },
  wipeNo: () => { ui.wipe = false; render(); },
  wipeYes: () => { ui.wipe = false; A.wipeDemo(); toast('Se borraron todos los datos.'); },

  /* nueva lista */
  nlBack: () => { if (ui.nl?.supId && (ui.nl.photos.length || ui.nl.mode)){ ui.nl.photos = []; ui.nl.mode = null; render(); return; } ui.nl = null; A.home(); },
  nlSup: el => { ui.nl.supId = el.dataset.id; render(); },
  nlChangeSup: () => { ui.nl.supId = null; ui.nl.photos = []; render(); },
  nlNewSup: () => {
    const name = $('#nl-name').value.trim();
    if (!name){ $('#nl-name').focus(); toast('Escribí el nombre del proveedor.'); return; }
    const x = {id: newId(), name, ivaIncluded: $('#nl-iva').checked, discount: 0, lastListAt: null, lists: 0, aiHint: ''};
    S.suppliers.push(x); save('suppliers'); ui.nl.supId = x.id; render();
  },
  nlPhoto: async () => { const fs = await pickFile('image/*', {capture: true}); addPhotos(fs); },
  nlGallery: async () => { const fs = await pickFile('image/*', {multiple: true}); addPhotos(fs); },
  nlDelPhoto: el => { const [p] = ui.nl.photos.splice(+el.dataset.i, 1); try { URL.revokeObjectURL(p.url); } catch {} render(); },
  nlReadPhotos: () => runPipeline('images', {photos: ui.nl.photos}),
  nlPdf: async () => { const [f] = await pickFile('application/pdf,.pdf'); if (f) runPipeline('pdf', f); },
  nlSheet: async () => { const [f] = await pickFile('.xlsx,.xls,.csv,.ods,text/csv'); if (f) runPipeline('sheet', f); },
  nlMode: el => { ui.nl.mode = el.dataset.v || null; render(); if (ui.nl.mode === 'text') setTimeout(() => $('#nl-text')?.focus(), 50); },
  nlReadText: () => { const t = $('#nl-text').value; ui.nl.text = t; if (!t.trim()){ toast('Pegá el texto de la lista.'); return; } runPipeline('text', {text: t}); },
  procCancel: () => { ui.proc?.ctl.abort(); ui.proc = null; screen('newlist'); },
  procBack: () => { if (ui.proc?.needCols) ui.proc.needCols.reject?.(Object.assign(new Error('x'), {code: 'cancelled'})); ui.proc?.ctl.abort(); ui.proc = null; if (ui.nl){ ui.nl.photos = ui.nl.photos || []; } screen('newlist'); },
  colsOk: () => { const nc = ui.proc.needCols; const cols = {header: nc.cols.header, desc: +$('#c-desc').value, cost: +$('#c-cost').value, code: +$('#c-code').value}; if (cols.desc === cols.cost){ toast('Elegí columnas distintas para descripción y costo.'); return; } nc.resolve(cols); },

  /* revisión */
  rvBack: () => { ui.review.leave = true; render(); window.scrollTo(0, 0); },
  rvStay: () => { ui.review.leave = false; render(); },
  rvDiscard: () => { ui.review = null; ui.nl = null; A.home(); },
  rvFilter: el => { ui.review.filter = ui.review.filter === el.dataset.v ? null : el.dataset.v; render(); },
  rvToggle: el => { const it = ui.review.items[+el.dataset.i]; it.include = !it.include; render(); },
  rvItem: el => { ui.sheet = {type: 'rvItem', i: +el.dataset.i}; renderSheet(); },
  rvSave: el => {
    const it = ui.review.items[+el.dataset.i];
    const v = $('#rv-price').value.trim(); it.override = v === '' ? null : parseNum(v); if (!(it.override > 0)) it.override = null;
    it.include = $('#rv-inc').checked;
    const pk = Math.round(parseNum($('#rv-pack').value)); it.pack = pk >= 1 ? pk : null;
    const cs = $('#rv-cat'); if (cs && cs.value !== '__new') it.newCat = cs.value;
    ui.sheet = null; render();
  },
  rvPick: el => { ui.sheet = {type: 'pick', i: +el.dataset.i, q: ''}; renderSheet(); },
  pickSet: el => { const it = ui.review.items[ui.sheet.i]; it.productId = el.dataset.id; it.doubt = false; it.ignored = false; it.include = true; it.match = 'manual'; ui.sheet = null; render(); },
  rvYes: el => { const it = ui.review.items[+el.dataset.i]; it.productId = it.suggest; it.doubt = false; it.include = true; it.match = 'manual'; render(); },
  rvNew: el => { const it = ui.review.items[+el.dataset.i]; it.productId = null; it.doubt = false; it.include = true; it.match = null; ui.sheet = null; render(); },
  rvIgnore: el => { const it = ui.review.items[+el.dataset.i]; it.productId = null; it.doubt = false; it.ignored = true; it.include = false; ui.sheet = null; render(); },
  rvUnignore: el => { const it = ui.review.items[+el.dataset.i]; it.ignored = false; it.include = true; it.match = null; const c = candidates(it.desc, ui.review.supId); it.cands = c.map(x => x.id); if (c[0] && c[0].score >= 0.42){ it.doubt = true; it.suggest = c[0].id; it.include = false; } render(); },
  rvAllNew: el => { const R = ui.review, sup = supById(R.supId); R.items.forEach(it => { if (calcItem(it, R, sup).st === 'new') it.include = el.dataset.v === '1'; }); render(); },
  rvMore: el => { ui.review.open[el.dataset.v] = true; render(); },
  rvIva: el => { ui.review.ivaOverride = el.dataset.v === '1'; render(); },
  rvIvaKeep: () => { ui.review.meta.iva = null; render(); },
  rvIvaSave: () => { const sup = supById(ui.review.supId); sup.ivaIncluded = !!ui.review.ivaOverride; save('suppliers'); ui.review.ivaOverride = null; render(); toast(`${sup.name} quedó configurado ${sup.ivaIncluded ? 'con' : 'sin'} IVA.`); },
  apply: () => applyReview(),

  /* resultados */
  batch: el => { ui.sheet = {type: 'batch', id: el.dataset.id}; renderSheet(); },
  labels: el => { const b = S.history.find(h => h.id === el.dataset.id); if (!b) return; ui.sheet = {type: 'labels', ids: b.changes.map(c => c.id).filter(id => byId(id)), size: 'm'}; renderSheet(); },
  lblSize: el => { ui.sheet.size = el.dataset.v; ui.sheet.store = $('#lbl-store').checked; renderSheet(); },
  lblGo: async el => { el.disabled = true; el.textContent = 'Generando…'; await makeLabels(ui.sheet.ids, ui.sheet.size, $('#lbl-store')?.checked); if (ui.sheet){ el.disabled = false; el.innerHTML = ic('dl', 20) + 'Descargar PDF'; } },
  exportBatch: el => exportBatch(el.dataset.id),
  undo: el => {
    const id = el.dataset.id;
    if (lastUndoable()?.id !== id){ toast('Solo se puede deshacer la última lista aplicada.'); return; }
    undoBatch(id); ui.sheet = null;
    if (ui.screen === 'done') render(); else render();
    toast('Listo, los precios volvieron a como estaban.');
  }
};
function addPhotos(files){
  for (const f of files || []) if (f.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/i.test(f.name)) ui.nl.photos.push({file: f, url: URL.createObjectURL(f)});
  render();
}

/* entradas que no re-dibujan toda la pantalla */
const IN = {
  pCalc: () => {
    const cost = parseNum($('#p-cost').value), mg = $('#p-margin').value.trim();
    const cat = $('#p-cat').value;
    const tmp = {category: cat, margin: mg === '' ? null : parseNum(mg)};
    if (!ui.sheet.manual && cost > 0) $('#p-price').value = String(priceFrom(cost, tmp)).replace('.', ',');
    pInfo();
  },
  pManual: () => { ui.sheet.manual = true; pInfo(); },
  pickQ: el => { ui.sheet.q = el.value; $('#pick-list').innerHTML = pickList(ui.sheet); }
};
function pInfo(){
  const cost = parseNum($('#p-cost').value), price = parseNum($('#p-price').value);
  const el = $('#p-info'); if (!el) return;
  if (cost > 0 && price > 0){
    const m = (price / cost - 1) * 100;
    el.innerHTML = price < cost ? `<b style="color:var(--bad)">Con ese precio perdés ${costTxt(cost - price)} por unidad.</b>` : `Ganancia por unidad: ${costTxt(price - cost)} (${NF1.format(m)} %)`;
  } else el.textContent = 'Si cargás el costo, el precio se calcula con tu margen.';
}
const CH = {
  catSel: el => { if (el.value === '__new' && !document.getElementById('catnew-' + el.id)){ el.insertAdjacentHTML('afterend', `<div class="row" style="margin-top:6px"><input class="inp grow" id="catnew-${el.id}" placeholder="Nombre de la categoría"><button class="btn sm" data-a="catCreate" data-for="${el.id}">Crear</button></div>`); setTimeout(() => document.getElementById('catnew-' + el.id)?.focus(), 30); } else if (el.id === 'p-cat') IN.pCalc(); },
  pBuy: () => { const w = $('#p-bn-w'); if (w) w.hidden = $('#p-buy').value !== 'pack'; },
  rvNewCat: el => { ui.review.newCat = el.value; render(); },
  impCol: el => { ui.imp.cols[el.dataset.k] = +el.value; render(); },
  impSup: el => { ui.imp.supId = el.value; },
  impRecalc: el => { ui.imp.recalc = el.checked; }
};

/* ============ eventos ============ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  try { fn(el, e); } catch (err) { console.error(err); toast('Algo salió mal. Probá de nuevo.'); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'q'){ ui.q = el.value; ui.plimit = 150; $('#plist').innerHTML = priceListHTML(); return; }
  if (el.dataset.in && IN[el.dataset.in]) IN[el.dataset.in](el);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.ch && CH[el.dataset.ch]) return CH[el.dataset.ch](el);
  if (el.dataset.set){
    const k = el.dataset.set;
    if (k === 'store'){ S.settings.store = el.value.trim() || S.settings.store; }
    else { const v = parseNum(el.value); if (!(v >= 0)){ toast('Escribí un número válido.'); el.value = S.settings[k]; return; } S.settings[k] = v; }
    save('settings'); if (k !== 'store') render(); toast('Guardado.');
    return;
  }
  if (el.dataset.cat !== undefined){
    const c = S.settings.categories[+el.dataset.cat]; const v = el.value.trim();
    c[el.dataset.k] = v === '' ? null : (parseNum(v) >= 0 ? parseNum(v) : null);
    save('settings'); render(); toast('Guardado.');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.sheet){ ui.sheet = null; renderSheet(); }
  if (e.key === 'Enter' && e.target.id === 'nl-name') A.nlNewSup();
  if (e.key === 'Enter' && e.target.id === 'newcat') A.addCat();
});
window.addEventListener('scroll', () => { const t = document.querySelector('.top'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, {passive: true});

/* ============ arranque ============ */
loadLocal();
if (S.settings) boot.loading = false;
render();
initAI().then(() => { if (ui.screen === 'newlist') render(); });
initCloud().finally(() => { boot.loading = false; if (!ui.sheet && ui.screen !== 'processing' && ui.screen !== 'review') render(); else updateSync(); });
setTimeout(() => { if (boot.loading){ boot.loading = false; render(); } }, 4000);
