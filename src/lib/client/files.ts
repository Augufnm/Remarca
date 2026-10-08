"use client";
/* Lectura de archivos en el navegador: planillas, PDFs y fotos. */
import type { Rows } from "@/lib/core/listread";

export class UserErr extends Error {}

export async function readSheetRows(file: File): Promise<Rows> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  let best: Rows | null = null;
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Rows[number]>(wb.Sheets[n], { header: 1, raw: true, defval: "" });
    const filled = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
    if (!best || filled.length > best.length) best = filled;
  }
  return (best || []).map((r) => r.map((c) => (typeof c === "string" ? c.trim() : c)));
}

export type PdfRead = { lines: string[]; images?: undefined } | { images: Blob[]; scanned: true; lines?: undefined };

/** PDF con texto: reconstruye los renglones por posición. PDF escaneado: rasteriza hasta 10 páginas. */
export async function readPdf(file: File, onProg?: (msg: string, pct: number) => void): Promise<PdfRead> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages = Math.min(pdf.numPages, 30);
  const lines: string[] = [];
  let chars = 0;
  for (let p = 1; p <= pages; p++) {
    onProg?.(`Leyendo página ${p} de ${pages}`, (p / pages) * 0.3);
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows: { y: number; parts: { x: number; s: string; w: number }[] }[] = [];
    for (const it of tc.items) {
      if (!("str" in it) || !it.str || !it.str.trim()) continue;
      const y = it.transform[5],
        x = it.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x, s: it.str, w: it.width || 0 });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.parts.sort((a, b) => a.x - b.x);
      let line = "",
        lastEnd: number | null = null;
      for (const pt of r.parts) {
        if (lastEnd !== null) line += pt.x - lastEnd > 12 ? "  |  " : " ";
        line += pt.s.trim();
        lastEnd = pt.x + pt.w;
      }
      lines.push(line);
      chars += line.length;
    }
  }
  if (chars > 40 * pages) return { lines };
  const images: Blob[] = [];
  for (let p = 1; p <= Math.min(pages, 10); p++) {
    onProg?.(`Preparando página ${p} para leerla`, 0.3);
    const page = await pdf.getPage(p);
    const vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(2.5, 1800 / Math.max(vp0.width, vp0.height)) });
    const cv = document.createElement("canvas");
    cv.width = vp.width;
    cv.height = vp.height;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    images.push(await toJpeg(cv));
  }
  return { images, scanned: true };
}

const toJpeg = (cv: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new UserErr("No se pudo preparar la imagen."))), "image/jpeg", 0.85));

/** Reduce la foto a 2000 px de lado, JPEG 85 %. */
export async function shrinkImage(file: Blob): Promise<Blob> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file);
  } catch {
    src = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new UserErr("No se pudo abrir la imagen. Probá con otra foto."));
      im.src = URL.createObjectURL(file);
    });
  }
  const w = src.width,
    h = src.height,
    k = Math.min(1, 2000 / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  return toJpeg(cv);
}

export function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]+,/, ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export function pickFile(accept: string, opts: { capture?: boolean; multiple?: boolean } = {}): Promise<File[]> {
  return new Promise((res) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept;
    inp.hidden = true;
    if (opts.capture) inp.setAttribute("capture", "environment");
    if (opts.multiple) inp.multiple = true;
    inp.onchange = () => {
      res(inp.files ? [...inp.files] : []);
      inp.remove();
    };
    inp.addEventListener("cancel", () => {
      res([]);
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
  });
}
