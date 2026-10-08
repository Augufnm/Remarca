import { NextResponse } from "next/server";
import { z } from "zod";
import { columnsPrompt } from "@/lib/ai/prompts";
import { ColumnsSchema, MODEL_QUICK, callJson } from "@/lib/ai/server";
import { aiErrorResponse, readBody } from "@/lib/ai/route-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  supplier: z.object({ name: z.string().max(200), aiHint: z.string().max(1000).optional() }),
  rows: z.array(z.array(z.string().max(200)).max(60)).max(25),
});

/** Reconoce las columnas de una planilla mirando solo las primeras filas. El resto se procesa en el navegador. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const { data, usage } = await callJson({
      model: MODEL_QUICK,
      content: [{ type: "text", text: columnsPrompt(body.supplier, body.rows) }],
      schema: ColumnsSchema,
      maxTokens: 2000,
      signal: req.signal,
    });
    return NextResponse.json({ ...data, usage });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
