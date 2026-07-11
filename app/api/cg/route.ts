import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/config/loader";
import { canalToken } from "@/lib/channel";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Data source da curadoria para o vMix (Data Sources Manager).
 * GET /api/cg?slug=<slug>&t=<token>[&format=xml]
 *
 * Retorna as mensagens curadas (array de objetos) que a equipe transmitiu.
 * O vMix monitora esta URL (JSON ou XML) e atualiza o GC automaticamente.
 * Protegido por token de canal (o mesmo do overlay) — some no painel.
 */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const formato = url.searchParams.get("format") === "xml" ? "xml" : "json";

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store, max-age=0",
  };

  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503, headers: cors });
  }

  const tenant = await resolveTenant(slug);
  if (!tenant?.liveId) {
    return NextResponse.json({ erro: "live_inexistente" }, { status: 404, headers: cors });
  }
  // Valida o token de canal (evita varrer slugs).
  if (token !== canalToken(tenant.liveId)) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403, headers: cors });
  }

  const itens = (tenant.config.cg?.mensagens ?? []).map((m) => ({
    id: m.id,
    nome: m.nome ?? "",
    mensagem: m.mensagem ?? "",
  }));

  if (formato === "xml") {
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<comentarios>\n` +
      itens
        .map(
          (m) =>
            `  <item>\n    <id>${m.id}</id>\n    <nome>${esc(m.nome)}</nome>\n    <mensagem>${esc(m.mensagem)}</mensagem>\n  </item>`
        )
        .join("\n") +
      `\n</comentarios>\n`;
    return new NextResponse(xml, {
      headers: { ...cors, "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  return new NextResponse(JSON.stringify(itens), {
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
