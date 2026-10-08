"use client";
/* Archivos de salida: Excel de precios y de cambios, etiquetas en PDF, copia de seguridad. */
import { fmtDate, fileSafe, priceTxt, r2, stamp } from "@/lib/core/format";
import { realMargin, unitTxt } from "@/lib/core/pricing";
import type { Batch, Data, Product } from "@/lib/core/types";

/** Descarga normal del navegador; en celulares que lo permiten, ofrece compartir. */
export async function saveFile(filename: string, blob: Blob, share = false): Promise<boolean> {
  try {
    if (share && typeof navigator !== "undefined" && navigator.canShare) {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    }
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

async function exportXlsx(sheetName: string, rows: unknown[][], filename: string, widths: number[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return saveFile(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), true);
}

const SELL_TXT = { u: "unidad", kg: "kilo", "100g": "100 g" } as const;

export function exportPrices(data: Data, products: Product[]) {
  const sup = (id: string | null) => data.suppliers.find((s) => s.id === id)?.name || "";
  const rows: unknown[][] = [["Código", "Producto", "Categoría", "Proveedor", "Se vende por", "Costo", "Margen %", "Precio de venta", "Precio actualizado"]];
  for (const p of products) {
    const m = realMargin(p);
    rows.push([p.code || "", p.name, p.category || "", sup(p.supplierId), SELL_TXT[p.sell || "u"], p.cost || null, m != null ? r2(m) : null, p.price, p.priceAt ? fmtDate(p.priceAt) : ""]);
  }
  return exportXlsx("Precios", rows, `precios-${fileSafe(data.settings?.store || "")}-${stamp()}.xlsx`, [12, 40, 16, 22, 12, 12, 10, 16, 16]);
}

export function exportBatch(data: Data, b: Batch) {
  const byId = new Map(data.products.map((p) => [p.id, p]));
  const rows: unknown[][] = [["Código", "Producto", "Costo anterior", "Costo nuevo", "Precio anterior", "Precio nuevo", "Variación %"]];
  for (const ch of b.changes) {
    const p = byId.get(ch.id);
    if (!p) continue;
    rows.push([p.code || "", p.name, ch.b ? ch.b.cost : null, ch.a.cost, ch.b ? ch.b.price : null, ch.a.price, ch.b && ch.b.price ? r2((ch.a.price / ch.b.price - 1) * 100) : null]);
  }
  return exportXlsx("Cambios", rows, `cambios-${fileSafe(b.supName)}-${stamp()}.xlsx`, [12, 40, 14, 14, 14, 14, 12]);
}

export type LabelSize = "s" | "m" | "g";

/** Etiquetas A4: chicas 4×10, medianas 3×8, grandes 2×5. */
export async function makeLabels(data: Data, ids: string[], size: LabelSize, withStore: boolean) {
  const { jsPDF } = await import("jspdf");
  const byId = new Map(data.products.map((p) => [p.id, p]));
  const prods = ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => !!p)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!prods.length) return false;
  const st = data.settings!;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = { s: { cols: 4, rows: 10, price: 22, name: 7.5, foot: 5.5 }, m: { cols: 3, rows: 8, price: 30, name: 9, foot: 6.5 }, g: { cols: 2, rows: 5, price: 50, name: 13, foot: 8 } }[size];
  const mx = 8,
    my = 8,
    W = (210 - 2 * mx) / L.cols,
    H = (297 - 2 * my) / L.rows,
    pad = 2.6,
    pt = 0.3528;
  const date = fmtDate(Date.now());
  prods.forEach((p, i) => {
    const k = i % (L.cols * L.rows);
    if (i && !k) doc.addPage();
    const x = mx + (k % L.cols) * W,
      y = my + Math.floor(k / L.cols) * H;
    doc.setDrawColor(200);
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.2);
    doc.rect(x, y, W, H);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(L.name);
    const lines = (doc.splitTextToSize(p.name, W - 2 * pad) as string[]).slice(0, 2);
    doc.text(lines, x + pad, y + pad + L.name * pt);
    const ut = unitTxt(p);
    if (ut) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(L.name * 0.85);
      doc.text(ut, x + pad, y + pad + L.name * pt * (lines.length + 1) + 0.8);
      doc.setFont("helvetica", "bold");
    }
    const txt = priceTxt(p.price, st.round);
    let fs = L.price;
    doc.setFontSize(fs);
    while (doc.getTextWidth(txt) + 6 > W - 2 * pad && fs > 10) {
      fs -= 1;
      doc.setFontSize(fs);
    }
    const py = y + H - pad - L.foot * pt - 1.2;
    doc.text(txt, x + W - pad, py, { align: "right" });
    const tw = doc.getTextWidth(txt);
    doc.setFontSize(fs * 0.5);
    doc.text("$", x + W - pad - tw - 1, py - fs * pt * 0.38, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.foot);
    doc.setTextColor(90, 90, 90);
    doc.text([date, withStore ? st.store : ""].filter(Boolean).join(" · ").slice(0, 60), x + pad, y + H - pad);
    if (p.code) doc.text(String(p.code).slice(0, 16), x + W - pad, y + H - pad, { align: "right" });
  });
  return saveFile(`etiquetas-${fileSafe(st.store)}-${stamp()}.pdf`, doc.output("blob"), true);
}

export function backup(data: Data) {
  const blob = new Blob([JSON.stringify({ app: "remarca", v: 1, at: Date.now(), data })], { type: "application/json" });
  return saveFile(`remarca-copia-${stamp()}.json`, blob);
}

/** Lanza confeti al aplicar una lista (respeta "reducir movimiento"). */
export function confetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas");
  cv.id = "confetti";
  document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    W = innerWidth,
    H = innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = W + "px";
  cv.style.height = H + "px";
  const ctx = cv.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const cols = ["--yellow", "--pink", "--sky", "--lime", "--orange", "--blue"].map((v) => cs.getPropertyValue(v).trim() || "#FFE135");
  const P = Array.from({ length: 60 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80,
    y: H * 0.32,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    w: 7 + Math.random() * 7,
    h: 4 + Math.random() * 6,
    c: cols[Math.floor(Math.random() * cols.length)],
    s: Math.random() < 0.3,
  }));
  let t = 0;
  (function frame() {
    ctx.clearRect(0, 0, W, H);
    t++;
    for (const p of P) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.strokeStyle = "#17112F";
      ctx.lineWidth = 1.2;
      if (p.s) {
        ctx.beginPath();
        ctx.arc(0, 0, p.h, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (t < 110) requestAnimationFrame(frame);
    else cv.remove();
  })();
}
