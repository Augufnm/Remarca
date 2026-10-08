'use strict';
/* ============ utilidades ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const NF0 = new Intl.NumberFormat('es-AR', {maximumFractionDigits: 0});
const NF2 = new Intl.NumberFormat('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const NF1 = new Intl.NumberFormat('es-AR', {maximumFractionDigits: 1});
const r2 = v => Math.round(v * 100) / 100;
function priceTxt(v){ if (v == null || !isFinite(v)) return '—'; const step = +(S.settings?.round) || 0; return (step >= 1 || Number.isInteger(v)) ? NF0.format(Math.round(v)) : NF2.format(v); }
function moneyHTML(v, cls=''){ return `<span class="tag ${cls}"><small>$</small>${priceTxt(v)}</span>`; }
const costTxt = v => (v == null || !isFinite(v)) ? '—' : '$ ' + NF2.format(v);
const pctTxt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + NF1.format(Math.abs(v)) + ' %';
function fmtDate(ts){ if(!ts) return '—'; const d = new Date(ts); return d.toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', year:'2-digit'}); }
function ago(ts){
  if (!ts) return 'nunca';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0){ const h = Math.floor((Date.now()-ts)/3600000); return h <= 0 ? 'recién' : `hace ${h} h`; }
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d/30); return m === 1 ? 'hace 1 mes' : `hace ${m} meses`;
}
/* números en formato argentino o internacional */
function parseNum(v){
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  let s = String(v ?? '').trim();
  if (!s) return NaN;
  s = s.replace(/[$\s]|ars|u\$s|usd/gi, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1){
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  } else if (lc > -1){
    const dec = s.length - lc - 1;
    s = (dec === 3 && (s.match(/,/g)||[]).length >= 1 && s.length > 4 && !/^0,/.test(s)) ? s.replace(/,/g, '') : s.replace(/,/g, (m, i) => i === lc ? '.' : '');
    if ((s.match(/\./g)||[]).length > 1) s = s.replace(/\./g, '');
  } else if (ld > -1){
    const parts = s.split('.');
    if (parts.length > 2) s = s.replace(/\./g, '');
    else if (parts[1].length === 3 && parts[0].length >= 1 && parts[0] !== '0') s = s.replace('.', '');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/* ============ estado y guardado ============ */
const SECTIONS = ['settings', 'suppliers', 'products', 'maps', 'history'];
const LS = 'remarca.v1.';
const S = {settings: null, suppliers: [], products: [], maps: {}, history: []};
const TS = {};
const persist = {mode: 'local', col: null, meta: {}, timers: {}, queue: Promise.resolve(), pending: 0, ready: false, error: null};

function lsGet(k){ try { return JSON.parse(localStorage.getItem(LS + k) || 'null'); } catch { return null; } }
function lsSet(k, v){ try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch { return false; } }
function loadLocal(){
  for (const k of SECTIONS){
    const v = lsGet(k);
    if (v && v.d !== undefined){ S[k] = v.d; TS[k] = v.ts || 0; }
  }
  if (!Array.isArray(S.suppliers)) S.suppliers = [];
  if (!Array.isArray(S.products)) S.products = [];
  if (!Array.isArray(S.history)) S.history = [];
  if (!S.maps || typeof S.maps !== 'object') S.maps = {};
}
function save(...secs){
  for (const k of secs){
    TS[k] = Date.now();
    lsSet(k, {ts: TS[k], d: S[k]});
    if (k === 'products') invalidateIndex();
    if (persist.mode === 'cloud'){
      clearTimeout(persist.timers[k]);
      persist.timers[k] = setTimeout(() => queueCloud(k), 900);
      persist.pending++; persist.timers['_'+k] = (persist.timers['_'+k]||0) + 1;
    }
  }
  updateSync();
}
function queueCloud(k){
  const n = persist.timers['_'+k] || 0; persist.timers['_'+k] = 0;
  persist.queue = persist.queue.then(() => cloudWrite(k)).catch(e => cloudFail(e)).finally(() => { persist.pending = Math.max(0, persist.pending - n); updateSync(); });
}
const CHUNK = 80000;
async function cloudWrite(k){
  const json = JSON.stringify(S[k]);
  const ts = TS[k] || Date.now();
  const n = Math.max(1, Math.ceil(json.length / CHUNK));
  for (let i = 0; i < n; i++) await persist.col.doc(k + '_' + i).set({s: json.slice(i * CHUNK, (i + 1) * CHUNK)});
  await persist.col.doc(k + '_meta').set({n, ts});
  const prev = persist.meta[k]?.n || 0;
  for (let i = n; i < prev; i++) await persist.col.doc(k + '_' + i).delete().catch(() => {});
  persist.meta[k] = {n, ts};
}
function cloudFail(e){
  const c = e?.code;
  if (c === 'invalid_argument' || c === 'revoked' || c === 'not_granted'){
    persist.mode = 'local'; persist.error = 'Tus datos se guardan solo en este dispositivo.';
  } else if (c === 'quota_exceeded'){
    toast('Se llenó el espacio en la nube. Tus datos siguen guardados en este dispositivo.');
  }
}
async function initCloud(){
  try {
    const [db, user] = await Promise.all([capUse('db'), capUse('user')]);
    if (!db || !user) return;
    const uid = await user.id().catch(() => null);
    if (!uid) return;
    const col = db.doc('data/users/' + uid + '/remarca').collection('chunks');
    const snap = await col.limit(1000).get();
    const docs = {}; for (const d of snap.docs) docs[d.id] = d.data();
    persist.col = col; persist.mode = 'cloud';
    const toPush = [];
    for (const k of SECTIONS){
      const m = docs[k + '_meta'];
      let cloud = null;
      if (m && m.n){
        try { let s = ''; for (let i = 0; i < m.n; i++) s += docs[k + '_' + i]?.s ?? ''; cloud = JSON.parse(s); } catch { cloud = null; }
        persist.meta[k] = {n: m.n, ts: m.ts};
      }
      if (cloud !== null && (m.ts || 0) >= (TS[k] || 0)){
        S[k] = cloud; TS[k] = m.ts; lsSet(k, {ts: m.ts, d: cloud});
      } else if (TS[k] && S[k] != null){ toPush.push(k); }
    }
    invalidateIndex();
    for (const k of toPush){ persist.pending++; persist.timers['_'+k] = 1; queueCloud(k); }
  } catch (e) {
    persist.mode = 'local';
  }
}

/* capacidades del visor */
function capUse(name){
  try { return (window.claude && window.claude.use) ? Promise.resolve(window.claude.use(name)).catch(() => null) : Promise.resolve(null); }
  catch { return Promise.resolve(null); }
}
const AI = {s: null, limits: null, off: false, checked: false};
async function initAI(){
  const s = await capUse('sample');
  if (s){ AI.s = s; try { AI.limits = await s.limits(); } catch { AI.limits = null; } }
  AI.checked = true;
}
const aiOn = () => !!AI.s && !AI.off;
const aiImagesOn = () => aiOn() && !!AI.limits?.images;

/* ============ precios ============ */
const DEFAULT_SETTINGS = () => ({store: '', margin: 40, iva: 21, round: 10, roundMode: 'up', ending: '', bigChange: 20, categories: [], createdAt: Date.now(), demo: false});
const supById = id => S.suppliers.find(s => s.id === id);
let _byId = null;
function byId(id){ if (!_byId){ _byId = new Map(S.products.map(p => [p.id, p])); } return _byId.get(id); }
function catOf(name){ return (S.settings.categories || []).find(c => c.name === name); }
const hasVal = v => v !== null && v !== undefined && v !== '' && isFinite(+v);
function marginFor(p){
  if (p && hasVal(p.margin)) return +p.margin;
  const c = p && catOf(p.category); if (c && hasVal(c.margin)) return +c.margin;
  return +S.settings.margin || 0;
}
function ivaFor(cat){ const c = catOf(cat); return c && hasVal(c.iva) ? +c.iva : (+S.settings.iva || 0); }
function roundPrice(v){
  const end = S.settings.ending;
  if (end === '9') return Math.ceil((v + 1) / 10 - 1e-9) * 10 - 1;
  if (end === '90') return Math.ceil((v + 10) / 100 - 1e-9) * 100 - 10;
  if (end === '99') return Math.ceil((v + 1) / 100 - 1e-9) * 100 - 1;
  const step = +S.settings.round || 0;
  if (!step) return r2(v);
  const q = v / step;
  return (S.settings.roundMode === 'near' ? Math.round(q) : Math.ceil(q - 1e-9)) * step;
}
const priceFrom = (cost, p) => roundPrice(cost * (1 + marginFor(p) / 100));
/* costo que paga el comercio por unidad: lista → +IVA si corresponde → −bonificación */
/* cuántas unidades de venta trae el precio de lista (bulto x 12 → 12; kilo vendido por 100 g → 10) */
function packOf(p){
  if (!p) return 1;
  const b = p.buy || {};
  let n = b.type === 'pack' ? (+b.n || 1) : 1;
  if (b.type === 'kg' && p.sell === '100g') n = 10;
  return n > 0 ? n : 1;
}
const UNIT_TXT = {u: '', kg: 'por kg', '100g': 'x 100 g'};
const unitTxt = p => UNIT_TXT[p?.sell || 'u'] || '';
function pushHist(p, ts){ p.hist = (p.hist || []).concat([[ts, p.cost, p.price]]).slice(-12); }
function costFromList(listed, sup, cat, ivaOverride, pack = 1){
  let c = +listed / (pack > 0 ? pack : 1);
  const inc = ivaOverride ?? !!sup.ivaIncluded;
  if (!inc) c *= 1 + ivaFor(cat) / 100;
  if (+sup.discount) c *= 1 - (+sup.discount) / 100;
  return r2(c);
}
const isLoss = p => p.cost > 0 && p.price > 0 && p.price < p.cost - 0.005;
const realMargin = p => p.cost > 0 ? (p.price / p.cost - 1) * 100 : null;

/* ============ vinculación con el catálogo ============ */
const STOP = new Set(['de','del','la','el','los','las','con','sin','en','y','p','x','por','para','a','al','e']);
function norm(s){
  s = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilogramos?|k)\b/g, '$1kg')
       .replace(/(\d+(?:\.\d+)?)\s*(grs?|gramos?|gms?|g)\b/g, '$1g')
       .replace(/(\d+(?:\.\d+)?)\s*(cc|ml|cm3|mililitros?)\b/g, '$1ml')
       .replace(/(\d+(?:\.\d+)?)\s*(lts?|litros?|l)\b/g, '$1l')
       .replace(/(\d+)\s*(unidades|unid|uds?|un|u)\b/g, '$1u');
  s = s.replace(/\b(\d+(?:\.\d+)?)g\b/g, (m, n) => (+n >= 1000 && +n % 1000 === 0) ? (+n / 1000) + 'kg' : m)
       .replace(/\b(\d+(?:\.\d+)?)ml\b/g, (m, n) => (+n >= 1000 && +n % 1000 === 0) ? (+n / 1000) + 'l' : m)
       .replace(/\b0\.(\d+)kg\b/g, (m, n) => Math.round(parseFloat('0.' + n) * 1000) + 'g')
       .replace(/\b0\.(\d+)l\b/g, (m, n) => Math.round(parseFloat('0.' + n) * 1000) + 'ml');
  s = s.replace(/[^a-z0-9.]+/g, ' ').replace(/(^|[^0-9])\.|\.(?![0-9])/g, '$1 ');
  return s.replace(/\s+/g, ' ').trim();
}
function prep(text){
  const n = norm(text);
  const toks = n.split(' ').filter(t => t && !STOP.has(t));
  const tok = new Set(toks);
  const joined = ' ' + toks.join(' ') + ' ';
  const tri = new Set(); for (let i = 0; i < joined.length - 2; i++) tri.add(joined.slice(i, i + 3));
  const nums = new Set(toks.filter(t => /\d/.test(t)));
  return {n, tok, tri, nums};
}
function dice(a, b){ if (!a.size || !b.size) return 0; let i = 0; const [s, l] = a.size < b.size ? [a, b] : [b, a]; for (const x of s) if (l.has(x)) i++; return 2 * i / (a.size + b.size); }
function sim(a, b){
  if (a.n && a.n === b.n) return 1;
  let s = 0.55 * dice(a.tok, b.tok) + 0.45 * dice(a.tri, b.tri);
  if (a.nums.size && b.nums.size){ let shared = false; for (const x of a.nums) if (b.nums.has(x)) { shared = true; break; } if (!shared) s *= 0.45; }
  else if (a.nums.size !== b.nums.size && (a.nums.size || b.nums.size)) s *= 0.9;
  return s;
}
let _idx = null;
function invalidateIndex(){ _idx = null; _byId = null; }
function getIndex(){
  if (_idx) return _idx;
  const inv = new Map(); const pre = new Map(); const byCode = new Map();
  for (const p of S.products){
    const pr = prep(p.name); pre.set(p.id, pr);
    for (const t of pr.tok){ if (!inv.has(t)) inv.set(t, []); inv.get(t).push(p.id); }
    if (p.code) byCode.set(normCode(p.code), p);
  }
  _idx = {inv, pre, byCode};
  return _idx;
}
const normCode = c => String(c || '').trim().toLowerCase().replace(/^0+(?=\d)/, '').replace(/\s+/g, '');
function itemKey(code, desc){ return code ? 'c:' + normCode(code) : 'd:' + norm(desc); }
function candidates(desc, supId, n = 5){
  const idx = getIndex(); const q = prep(desc);
  const seen = new Set(); const out = [];
  const total = S.products.length || 1;
  for (const t of q.tok){
    const ids = idx.inv.get(t); if (!ids) continue;
    if (ids.length > Math.max(60, total * 0.35) && q.tok.size > 1) continue;
    for (const id of ids){ if (seen.has(id)) continue; seen.add(id);
      const p = byId(id); const pp = idx.pre.get(id); let sc = sim(q, pp);
      // una palabra distintiva del renglón (marca, variedad) que el producto no tiene: probablemente es otro producto
      if (sc < 1){
        let miss = false;
        for (const t of q.tok){ if (/\d/.test(t) || pp.tok.has(t)) continue; const df = idx.inv.get(t)?.length || 0; if (df >= 1 && df <= 3){ sc *= 0.7; miss = true; } }
        // y además el producto tiene otra marca o variedad propia: casi seguro que no es
        if (miss) for (const t of pp.tok){ if (/\d/.test(t) || q.tok.has(t)) continue; const df = idx.inv.get(t)?.length || 0; if (df >= 1 && df <= 3){ sc *= 0.6; break; } }
      }
      if (p && supId && p.supplierId === supId) sc = Math.min(1, sc + 0.03);
      out.push({id, score: sc});
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, n);
}
function matchItems(raw, sup){
  const maps = S.maps[sup.id] || {};
  const idx = getIndex();
  return raw.map(r => {
    const key = itemKey(r.code, r.desc);
    const it = {key, code: r.code || '', desc: r.desc, listed: r.cost, productId: null, match: null, score: 0, cands: [], include: true, doubt: false, ignored: false, override: null, newCat: '', note: r.note || '', aiPack: r.pack > 1 ? r.pack : 1, pack: null};
    const m = maps[key];
    if (m === '-'){ it.ignored = true; it.include = false; it.match = 'ignorado'; return it; }
    if (m && byId(m)){ it.productId = m; it.match = 'memoria'; return it; }
    if (r.code){
      const p = idx.byCode.get(normCode(r.code));
      if (p && (!p.supplierId || p.supplierId === sup.id)){ it.productId = p.id; it.match = 'codigo'; return it; }
    }
    const c = candidates(r.desc, sup.id);
    it.cands = c.map(x => x.id);
    const b = c[0], s2 = c[1]?.score ?? 0;
    if (b){
      it.score = b.score;
      if (b.score >= 0.97 && s2 < 0.97){ it.productId = b.id; it.match = 'exacto'; }
      else if (b.score >= 0.84 && s2 < b.score - 0.06){ it.productId = b.id; it.match = 'similar'; }
      else if (b.score >= 0.42){ it.doubt = true; it.include = false; it.suggest = b.id; }
    }
    return it;
  });
}

/* ============ lectura de archivos ============ */
const LIBS = {
  xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
  jspdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'],
  pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js']
};
const _libs = {};
function loadLib(name){
  if (_libs[name]) return _libs[name];
  _libs[name] = LIBS[name].reduce((p, src) => p.then(() => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => { delete _libs[name]; rej(new UserErr('No se pudo cargar una herramienta necesaria. Revisá tu conexión y probá de nuevo.')); };
    document.head.appendChild(s);
  })), Promise.resolve());
  return _libs[name];
}
class UserErr extends Error {}

async function readSheetRows(file){
  await loadLib('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {type: 'array', cellDates: false});
  let best = null;
  for (const n of wb.SheetNames){
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header: 1, raw: true, defval: ''});
    const filled = rows.filter(r => r.some(c => String(c).trim() !== ''));
    if (!best || filled.length > best.length) best = filled;
  }
  return (best || []).map(r => r.map(c => typeof c === 'string' ? c.trim() : c));
}
const KW = {
  code: /^(cod|c[oó]d(igo)?|sku|art(\.|[ií]culo)?\s*(n|nro|#)?|ean|ref|item|id|plu)\b/i,
  desc: /(desc|producto|art[ií]culo|detalle|nombre|item|mercader)/i,
  cost: /(costo|precio|p\.?\s?unit|unitario|lista|neto|importe|valor|\$|pcio|final)/i,
  cat: /(rubro|categor|familia|secci[oó]n|grupo|l[ií]nea)/i,
  price: /(venta|p\.?\s?v\.?p|p[uú]blico|pvp|precio\s*sug)/i,
  sup: /(proveedor|marca|distrib)/i
};
function guessCols(rows, forCatalog){
  let hdr = -1, best = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++){
    const r = rows[i]; let sc = 0;
    for (const c of r){ const s = String(c); if (typeof c === 'string' && s.length < 40 && (KW.desc.test(s) || KW.cost.test(s) || KW.code.test(s) || KW.cat.test(s))) sc++; }
    if (sc > best){ best = sc; hdr = i; }
  }
  const H = hdr >= 0 ? rows[hdr].map(String) : [];
  const data = rows.slice(hdr + 1, hdr + 60);
  const ncol = Math.max(...rows.slice(0, 60).map(r => r.length), 0);
  const numRatio = j => { let n = 0, t = 0; for (const r of data){ const v = r[j]; if (v === '' || v == null) continue; t++; if (isFinite(parseNum(v)) && parseNum(v) > 0) n++; } return t ? n / t : 0; };
  const textLen = j => { let L = 0, t = 0; for (const r of data){ const v = r[j]; if (typeof v === 'string' && /[a-záéíóúñ]/i.test(v)){ L += v.length; t++; } } return t ? L / Math.max(1, data.length) : 0; };
  const find = (re, not) => { for (let j = 0; j < H.length; j++) if (re.test(H[j]) && !(not && not.some(x => x === j))) return j; return -1; };
  const cols = {header: hdr, code: -1, desc: -1, cost: -1, cat: -1, price: -1};
  cols.code = find(KW.code);
  cols.desc = find(KW.desc, [cols.code]);
  if (forCatalog){ cols.price = find(KW.price); cols.cat = find(KW.cat); }
  const costCands = []; for (let j = 0; j < H.length; j++) if (KW.cost.test(H[j]) && j !== cols.price && j !== cols.code && j !== cols.desc) costCands.push(j);
  const pref = costCands.find(j => /(costo|neto|s\/?\s?iva|sin iva|contado)/i.test(H[j]));
  cols.cost = pref ?? costCands.find(j => numRatio(j) > 0.6) ?? -1;
  if (forCatalog && cols.price === -1 && cols.cost !== -1 && costCands.length === 1 && !/costo|neto/i.test(H[cols.cost])){ cols.price = cols.cost; cols.cost = -1; }
  if (cols.desc === -1){ let bj = -1, bl = 0; for (let j = 0; j < ncol; j++){ if (j === cols.code) continue; const l = textLen(j); if (l > bl){ bl = l; bj = j; } } cols.desc = bj; }
  if (cols.cost === -1 && !forCatalog){ for (let j = ncol - 1; j >= 0; j--){ if (j === cols.code || j === cols.desc) continue; if (numRatio(j) > 0.7){ cols.cost = j; break; } } }
  return cols;
}
function rowsToItems(rows, cols){
  const out = [];
  for (let i = cols.header + 1; i < rows.length; i++){
    const r = rows[i];
    const desc = String(r[cols.desc] ?? '').trim();
    const cost = parseNum(r[cols.cost]);
    if (!desc || !/[a-záéíóúñ]/i.test(desc) || !(cost > 0)) continue;
    out.push({code: cols.code >= 0 ? String(r[cols.code] ?? '').trim() : '', desc, cost});
  }
  return out;
}
async function readPdf(file, onProg){
  await loadLib('pdf');
  const pdf = await pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false}).promise;
  const pages = Math.min(pdf.numPages, 30);
  const lines = []; let chars = 0;
  for (let p = 1; p <= pages; p++){
    onProg?.(`Leyendo página ${p} de ${pages}`, p / pages * 0.3);
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items){
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5], x = it.transform[4];
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row){ row = {y, parts: []}; rows.push(row); }
      row.parts.push({x, s: it.str, w: it.width || 0});
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows){
      r.parts.sort((a, b) => a.x - b.x);
      let line = '', lastEnd = null;
      for (const pt of r.parts){ if (lastEnd !== null) line += (pt.x - lastEnd > 12 ? '  |  ' : ' '); line += pt.s.trim(); lastEnd = pt.x + pt.w; }
      lines.push(line); chars += line.length;
    }
  }
  if (chars > 40 * pages) return {lines};
  const imgs = [];
  for (let p = 1; p <= Math.min(pages, 10); p++){
    onProg?.(`Preparando página ${p} para leerla`, 0.3);
    const page = await pdf.getPage(p);
    const vp0 = page.getViewport({scale: 1});
    const vp = page.getViewport({scale: Math.min(2.5, 1800 / Math.max(vp0.width, vp0.height))});
    const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({canvasContext: ctx, viewport: vp}).promise;
    imgs.push(await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.85)));
  }
  return {images: imgs, scanned: true};
}
async function shrinkImage(file){
  let src;
  try { src = await createImageBitmap(file); }
  catch {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new UserErr('No se pudo abrir la imagen. Probá con otra foto.')); im.src = URL.createObjectURL(file); });
  }
  const w = src.width, h = src.height, k = Math.min(1, 2000 / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(res, 'image/jpeg', 0.85));
}
/* lectura sin IA: última cifra con forma de precio en cada renglón */
function heuristicLines(lines){
  const out = [];
  const priceRe = /\$?\s?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\$?\s?\d+(?:[.,]\d{1,2})?/g;
  for (let raw of lines){
    const line = String(raw).replace(/\s*\|\s*/g, '   ').trim();
    if (!/[a-záéíóúñ]{3,}/i.test(line)) continue;
    const ms = [...line.matchAll(priceRe)];
    if (!ms.length) continue;
    const last = ms[ms.length - 1];
    const cost = parseNum(last[0]);
    if (!(cost > 0)) continue;
    let rest = (line.slice(0, last.index) + ' ' + line.slice(last.index + last[0].length)).trim();
    let code = '';
    const cm = rest.match(/^([A-Z0-9][A-Z0-9\-\/.]{1,11})\s+(?=\S)/i);
    if (cm && /\d/.test(cm[1])){ code = cm[1]; rest = rest.slice(cm[0].length); }
    rest = rest.replace(/\s+\$?\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    if (rest.length < 3) continue;
    const pm = rest.match(/\b(?:caja|bulto|pack|display|cj|bto)\s*(?:x|de)?\s*(\d{1,3})\s*(?:u|un|unid|unidades)?\b/i);
    out.push({code, desc: rest, cost, pack: pm ? Math.max(1, +pm[1]) : 1});
  }
  return out;
}

/* ============ IA ============ */
function aiErrMsg(e){
  const c = e?.code;
  if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)){ AI.off = true; return 'La lectura con IA no está habilitada en este acceso. Podés subir la lista en Excel o pegarla como texto.'; }
  if (c === 'rate_limited') return 'Se alcanzó el límite de uso de la IA por ahora. Probá de nuevo en unos minutos.';
  if (c === 'session_expired') return 'Tu sesión venció. Volvé a iniciar sesión y probá otra vez.';
  if (c === 'image_rejected') return 'No se pudo leer la imagen. Probá con otra foto, más nítida y con buena luz.';
  if (c === 'images_unavailable'){ return 'La lectura de fotos no está disponible en este acceso. Subí la lista en PDF, Excel o como texto.'; }
  if (c === 'prompt_too_large') return 'La lista es demasiado larga para leerla de una vez. Probá dividirla en partes.';
  if (c === 'cancelled') return 'cancelled';
  if (c === 'refused' || c === 'invalid_json' || c === 'empty_completion') return 'La IA no pudo interpretar esta parte de la lista.';
  return 'Hubo un problema de conexión con la IA. Probá de nuevo.';
}
function extractPrompt(sup, what){
  const hint = sup.aiHint ? `\nPara este proveedor ya sabemos: "${sup.aiHint}". Respetalo salvo que la lista diga claramente otra cosa.` : '';
  return `Sos un asistente que lee listas de precios de proveedores mayoristas para un comercio minorista de Argentina.
${what}
Extraé CADA producto con su precio de costo unitario.
Reglas:
- Los números suelen estar en formato argentino: "1.234,56" es 1234.56 y "12.500" es 12500. Devolvé el número como número JSON con punto decimal.
- Si hay varias columnas de precio (por ejemplo "s/IVA" y "c/IVA", "contado" y "lista", "bulto" y "unidad"), usá el precio unitario. Entre sin IVA y con IVA, preferí SIN IVA si existe.
- La descripción debe incluir marca, variedad y presentación (peso, volumen, unidades) tal como aparece.
- Incluí el código del proveedor si existe; si no, usá "".
- Ignorá encabezados, subtotales, totales, teléfonos, condiciones de venta y renglones sin precio.
- No inventes productos ni precios. Si un precio no se lee con seguridad, omití ese producto.${hint}
Respondé SOLO con JSON con esta forma exacta:
{"iva":"incluido"|"no_incluido"|"no_dice","columna":"breve descripción de qué columna de precio usaste","items":[["código","descripción",1234.56,1]]}
El cuarto valor de cada ítem es cuántas unidades de venta incluye ese precio: 1 si es precio por unidad o por kilo; si el único precio es por bulto, caja, pack o display (por ejemplo "caja x 12", "pack x 6", "x24u"), poné esa cantidad.`;
}
function cleanAiItems(res){
  const arr = Array.isArray(res) ? res : (res && Array.isArray(res.items) ? res.items : []);
  const out = [];
  for (const x of arr){
    let code = '', desc = '', cost = NaN, pack = 1;
    if (Array.isArray(x)){ [code, desc, cost, pack] = x.length >= 3 ? x : ['', x[0], x[1], 1]; }
    else if (x && typeof x === 'object'){ code = x.codigo ?? x.code ?? ''; desc = x.descripcion ?? x.desc ?? x.nombre ?? ''; cost = x.precio ?? x.costo ?? x.cost; pack = x.unidades ?? 1; }
    pack = Math.round(+pack); if (!(pack >= 1 && pack <= 1000)) pack = 1;
    cost = parseNum(cost); desc = String(desc ?? '').trim(); code = String(code ?? '').trim();
    if (desc && cost > 0) out.push({code, desc, cost, pack});
  }
  return out;
}
async function aiExtractImages(blobs, sup, signal, onProg){
  const items = []; const warn = []; let meta = {};
  const max = AI.limits?.images?.maxCount || 1;
  for (let i = 0; i < blobs.length; i++){
    onProg?.(`Leyendo ${blobs.length > 1 ? `página ${i + 1} de ${blobs.length}` : 'la lista'} con IA`, 0.35 + 0.45 * (i / blobs.length));
    try {
      const res = await AI.s.json(extractPrompt(sup, `Te paso la foto de una página de la lista de precios del proveedor "${sup.name}".`), {images: [blobs[i]].slice(0, max), signal, modelTier: 'default'});
      items.push(...cleanAiItems(res));
      if (res && !Array.isArray(res)) meta = {iva: res.iva || meta.iva, columna: res.columna || meta.columna};
    } catch (e) {
      const m = aiErrMsg(e);
      if (m === 'cancelled') throw e;
      if (AI.off || e?.code === 'rate_limited' || e?.code === 'session_expired' || e?.code === 'images_unavailable') throw new UserErr(m);
      warn.push(`${blobs.length > 1 ? `Página ${i + 1}: ` : ''}${m}`);
    }
  }
  return {items, warn, meta};
}
async function aiExtractText(lines, sup, signal, onProg){
  const items = []; const warn = []; let meta = {};
  const clean = lines.map(l => String(l).trim()).filter(l => l && /\d/.test(l));
  const chunks = []; let cur = [], size = 0;
  for (const l of clean){ cur.push(l); size += l.length; if (cur.length >= 140 || size > 9000){ chunks.push(cur); cur = []; size = 0; } }
  if (cur.length) chunks.push(cur);
  for (let i = 0; i < chunks.length; i++){
    onProg?.(`Interpretando la lista con IA${chunks.length > 1 ? ` (parte ${i + 1} de ${chunks.length})` : ''}`, 0.35 + 0.45 * (i / chunks.length));
    try {
      const res = await AI.s.json(extractPrompt(sup, `Este es el texto de ${chunks.length > 1 ? `la parte ${i + 1} de ${chunks.length} de ` : ''}la lista de precios del proveedor "${sup.name}" (las columnas pueden venir separadas por "|" o espacios):\n"""\n${chunks[i].join('\n')}\n"""`), {signal, modelTier: 'default'});
      items.push(...cleanAiItems(res));
      if (res && !Array.isArray(res)) meta = {iva: res.iva || meta.iva, columna: res.columna || meta.columna};
    } catch (e) {
      const m = aiErrMsg(e);
      if (m === 'cancelled') throw e;
      if (AI.off || e?.code === 'rate_limited' || e?.code === 'session_expired'){
        if (!items.length){ const h = heuristicLines(clean); if (h.length){ warn.push(m + ' Leímos la lista sin IA; revisá los resultados.'); return {items: h, warn, meta}; } }
        throw new UserErr(m);
      }
      const h = heuristicLines(chunks[i]);
      items.push(...h);
      warn.push(`${chunks.length > 1 ? `Parte ${i + 1}: ` : ''}${m} Se leyó sin IA; revisala.`);
    }
  }
  return {items, warn, meta};
}
async function aiDetectCols(rows, sup, signal){
  const sample = rows.slice(0, 25).map((r, i) => i + '\t' + r.map(c => String(c).slice(0, 40)).join('\t')).join('\n');
  const res = await AI.s.json(`Estas son las primeras filas de una planilla con la lista de precios del proveedor "${sup.name}" de un comercio argentino. Cada fila empieza con su número y las columnas están separadas por tabulaciones (la primera columna de datos es la 0).
${sup.aiHint ? `Para este proveedor ya sabemos: "${sup.aiHint}".\n` : ''}
"""
${sample}
"""
Indicá qué columna tiene cada dato. "costo" es el precio unitario que paga el comercio (preferí sin IVA si hay dos). Usá -1 si no existe.
Respondé SOLO JSON: {"fila_encabezado":número o -1,"codigo":n,"descripcion":n,"costo":n,"iva":"incluido"|"no_incluido"|"no_dice","columna":"nombre de la columna de costo"}`, {signal, modelTier: 'quick'});
  const c = {header: Number.isInteger(res?.fila_encabezado) ? res.fila_encabezado : -1, code: +res?.codigo, desc: +res?.descripcion, cost: +res?.costo};
  if (!(c.desc >= 0) || !(c.cost >= 0)) return null;
  if (!(c.code >= 0)) c.code = -1;
  return {cols: c, meta: {iva: res.iva, columna: res.columna}};
}
async function aiResolveDoubts(items, signal, onProg){
  const batches = []; for (let i = 0; i < items.length; i += 25) batches.push(items.slice(i, i + 25));
  let done = 0;
  for (const b of batches){
    onProg?.(`Confirmando coincidencias dudosas con IA (${Math.min(done + b.length, items.length)} de ${items.length})`, 0.85 + 0.12 * (done / items.length));
    const payload = b.map((it, i) => ({i, lista: it.desc, opciones: it.cands.slice(0, 5).map(id => ({id, n: byId(id)?.name}))}));
    try {
      const res = await AI.s.json(`Un comercio recibió la lista de un proveedor. Para cada renglón de la lista, decidí cuál producto del catálogo del comercio es EXACTAMENTE el mismo producto: misma marca, misma variedad y misma presentación (peso, volumen o cantidad). Las abreviaturas son comunes ("YERBA PLAY 1K" = "Yerba Playadito 1 kg"). Si ninguno es el mismo, respondé null. Ante la duda entre tamaños o variedades distintas, respondé null.
${JSON.stringify(payload)}
Respondé SOLO JSON: un array de pares [i, "id elegido" o null], por ejemplo [[0,"abc"],[1,null]].`, {signal, modelTier: 'quick'});
      if (Array.isArray(res)) for (const pair of res){
        if (!Array.isArray(pair)) continue;
        const it = b[pair[0]]; if (!it) continue;
        const id = pair[1];
        it.aiChecked = true;
        if (id && it.cands.includes(id)){ it.productId = id; it.doubt = false; it.include = true; it.match = 'ia'; }
        else if (id === null){ it.doubt = false; it.include = S.products.length < 10; it.match = null; it.productId = null; it.aiNew = true; }
      }
    } catch (e) {
      if (e?.code === 'cancelled') throw e;
      break;
    }
    done += b.length;
  }
}
