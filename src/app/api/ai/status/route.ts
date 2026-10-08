import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai/server";

export const dynamic = "force-dynamic";

export function GET() {
  const on = aiEnabled();
  return NextResponse.json({ enabled: on, images: on });
}
