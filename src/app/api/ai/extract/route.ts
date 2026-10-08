import { NextResponse } from "next/server";
import { z } from "zod";
import { EXTRACT_SYSTEM, extractImageUser, extractTextUser } from "@/lib/ai/prompts";
import { ExtractSchema, MODEL_VISION, callJson } from "@/lib/ai/server";
import { aiErrorResponse, readBody } from "@/lib/ai/route-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  supplier: z.object({ name: z.string().max(200), aiHint: z.string().max(1000).optional() }),
  text: z.string().max(40_000).optional(),
  part: z.object({ i: z.number().int(), n: z.number().int() }).optional(),
  image: z.object({ data: z.string().max(7_000_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]) }).optional(),
});

/** Lee una página (foto) o una parte del texto de una lista y devuelve productos y costos. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  if (!body.text && !body.image) return NextResponse.json({ code: "bad_request" }, { status: 400 });
  try {
    const content = body.image
      ? [
          { type: "image" as const, source: { type: "base64" as const, media_type: body.image.mediaType, data: body.image.data } },
          { type: "text" as const, text: extractImageUser(body.supplier) },
        ]
      : [{ type: "text" as const, text: extractTextUser(body.supplier, body.text!, body.part) }];
    const { data, usage } = await callJson({ model: MODEL_VISION, system: EXTRACT_SYSTEM, content, schema: ExtractSchema, maxTokens: 16000, signal: req.signal });
    return NextResponse.json({
      iva: data.iva,
      columna: data.columna,
      items: data.items.map((x) => [x.c, x.d, x.p, x.u]),
      usage,
    });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
