import { NextResponse } from "next/server";
import { z } from "zod";
import { DOUBTS_SYSTEM, doubtsUser } from "@/lib/ai/prompts";
import { DoubtsSchema, MODEL_QUICK, callJson } from "@/lib/ai/server";
import { aiErrorResponse, readBody } from "@/lib/ai/route-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  items: z
    .array(
      z.object({
        i: z.number().int(),
        lista: z.string().max(300),
        opciones: z.array(z.object({ id: z.string().max(64), n: z.string().max(300) })).max(5),
      }),
    )
    .max(25),
});

/** Confirma coincidencias dudosas: de a 25 renglones, con hasta 5 candidatos cada uno. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const { data, usage } = await callJson({
      model: MODEL_QUICK,
      system: DOUBTS_SYSTEM,
      content: [{ type: "text", text: doubtsUser(body.items) }],
      schema: DoubtsSchema,
      maxTokens: 4000,
      signal: req.signal,
    });
    return NextResponse.json({ pairs: data.pares.map((p) => [p.i, p.id]), usage });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
