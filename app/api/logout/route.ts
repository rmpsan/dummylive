import { NextResponse } from "next/server";
import { clearViewerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encerra a sessão do espectador (limpa o cookie assinado). */
export async function POST() {
  await clearViewerSession();
  return NextResponse.json({ ok: true });
}
