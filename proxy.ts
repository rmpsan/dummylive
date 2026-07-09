import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

/**
 * Renova/rotaciona o token de sessão de staff (Supabase Auth) e reescreve o
 * cookie, evitando que a equipe caia no meio de uma live longa (M2 da
 * auditoria). Só roda nas rotas de staff/super — o espectador usa cookie
 * HMAC próprio e não precisa disso.
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const p = req.nextUrl.pathname;
  const rotaStaff =
    p === "/super" ||
    p.startsWith("/super/") ||
    /\/(staff|moderacao|admin|dashboard)(\/|$)/.test(p);
  if (!rotaStaff || !isSupabaseConfigured) return res;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = {
  // Roda em rotas de página (exclui api, assets estáticos e arquivos).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
