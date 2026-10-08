import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AiError } from "./server";

/** Límite de tamaño de pedido: una foto reducida a 2000 px pesa bastante menos. */
const MAX_BODY = 8 * 1024 * 1024;

export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | NextResponse> {
  const len = +(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return NextResponse.json({ code: "prompt_too_large" }, { status: 413 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request" }, { status: 400 });
  }
  const r = schema.safeParse(json);
  if (!r.success) return NextResponse.json({ code: "bad_request" }, { status: 400 });
  return r.data;
}

export function aiErrorResponse(e: unknown) {
  if (e instanceof AiError) {
    const status = e.code === "not_configured" ? 503 : e.code === "rate_limited" ? 429 : e.code === "connection" ? 502 : 422;
    return NextResponse.json({ code: e.code }, { status });
  }
  console.error(e);
  return NextResponse.json({ code: "connection" }, { status: 500 });
}
