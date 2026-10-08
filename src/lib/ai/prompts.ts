/* Prompts de IA (tomados del prototipo). La parte fija va primero para aprovechar el caché. */

export interface SupplierCtx {
  name: string;
  aiHint?: string;
}

export const EXTRACT_SYSTEM = `Sos un asistente que lee listas de precios de proveedores mayoristas para un comercio minorista de Argentina.
Extraé CADA producto con su precio de costo unitario.
Reglas:
- Los números suelen estar en formato argentino: "1.234,56" es 1234.56 y "12.500" es 12500. Devolvé el número como número JSON con punto decimal.
- Si hay varias columnas de precio (por ejemplo "s/IVA" y "c/IVA", "contado" y "lista", "bulto" y "unidad"), usá el precio unitario. Entre sin IVA y con IVA, preferí SIN IVA si existe.
- La descripción debe incluir marca, variedad y presentación (peso, volumen, unidades) tal como aparece.
- Incluí el código del proveedor si existe; si no, usá "".
- Ignorá encabezados, subtotales, totales, teléfonos, condiciones de venta y renglones sin precio.
- No inventes productos ni precios. Si un precio no se lee con seguridad, omití ese producto.
Formato de salida:
- "iva": "incluido", "no_incluido" o "no_dice", según lo que diga la lista.
- "columna": breve descripción de qué columna de precio usaste.
- "items": un objeto por producto con "c" (código), "d" (descripción), "p" (precio) y "u" (unidades de venta que incluye ese precio: 1 si es precio por unidad o por kilo; si el único precio es por bulto, caja, pack o display, por ejemplo "caja x 12", "pack x 6", "x24u", poné esa cantidad).`;

function hint(sup: SupplierCtx) {
  return sup.aiHint ? `\nPara este proveedor ya sabemos: "${sup.aiHint}". Respetalo salvo que la lista diga claramente otra cosa.` : "";
}

export function extractImageUser(sup: SupplierCtx) {
  return `Te paso la foto de una página de la lista de precios del proveedor "${sup.name}".${hint(sup)}`;
}

export function extractTextUser(sup: SupplierCtx, text: string, part?: { i: number; n: number }) {
  const where = part && part.n > 1 ? `la parte ${part.i} de ${part.n} de ` : "";
  return `Este es el texto de ${where}la lista de precios del proveedor "${sup.name}" (las columnas pueden venir separadas por "|" o espacios):${hint(sup)}
"""
${text}
"""`;
}

export function columnsPrompt(sup: SupplierCtx, rows: string[][]) {
  const sample = rows
    .slice(0, 25)
    .map((r, i) => i + "\t" + r.map((c) => String(c).slice(0, 40)).join("\t"))
    .join("\n");
  return `Estas son las primeras filas de una planilla con la lista de precios del proveedor "${sup.name}" de un comercio argentino. Cada fila empieza con su número y las columnas están separadas por tabulaciones (la primera columna de datos es la 0).
${sup.aiHint ? `Para este proveedor ya sabemos: "${sup.aiHint}".\n` : ""}
"""
${sample}
"""
Indicá qué columna tiene cada dato. "costo" es el precio unitario que paga el comercio (preferí sin IVA si hay dos). Usá -1 si no existe.
Devolvé "fila_encabezado" (número o -1), "codigo", "descripcion", "costo", "iva" ("incluido", "no_incluido" o "no_dice") y "columna" (nombre de la columna de costo).`;
}

export const DOUBTS_SYSTEM = `Un comercio recibió la lista de un proveedor. Para cada renglón de la lista, decidí cuál producto del catálogo del comercio es EXACTAMENTE el mismo producto: misma marca, misma variedad y misma presentación (peso, volumen o cantidad). Las abreviaturas son comunes ("YERBA PLAY 1K" = "Yerba Playadito 1 kg"). Si ninguno es el mismo, respondé null. Ante la duda entre tamaños o variedades distintas, respondé null.
Devolvé "pares": un objeto por renglón con "i" (número del renglón) e "id" (el id elegido, o null).`;

export interface DoubtPayload {
  i: number;
  lista: string;
  opciones: { id: string; n: string }[];
}

export const doubtsUser = (payload: DoubtPayload[]) => JSON.stringify(payload);
