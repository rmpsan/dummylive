import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export interface SuperCtx {
  email: string;
}

/**
 * Resolve o super-admin da plataforma (usuário autenticado cujo email está em
 * `super_admins`). Diferente do staff, não é preso a uma live — gerencia
 * clientes, jobs e lives no banco todo.
 */
export async function getSuperAdmin(): Promise<SuperCtx | null> {
  if (!isServiceRoleConfigured) return null;
  const supabase = await getServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const admin = getAdminClient();
  const { data } = await admin
    .from("super_admins")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  return data ? { email: user.email } : null;
}
