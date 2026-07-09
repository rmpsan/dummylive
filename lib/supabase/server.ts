import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./env";

/**
 * Client Supabase de servidor com sessão de Auth via cookies (@supabase/ssr).
 * Usado para ler o usuário staff autenticado em Server Components e Route
 * Handlers. Em Server Component o `setAll` é no-op (só rotas/middleware podem
 * escrever cookies) — envolto em try/catch conforme o padrão do @supabase/ssr.
 */
export async function getServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            jar.set(name, value, options)
          );
        } catch {
          /* Server Component: ignorado. */
        }
      },
    },
  });
}
