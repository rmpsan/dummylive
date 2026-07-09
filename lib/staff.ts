import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export type PapelStaff = "moderador" | "admin" | "super_admin";

export interface StaffContext {
  userId: string;
  email: string;
  papel: PapelStaff;
  liveId: string;
}

const RANK: Record<PapelStaff, number> = {
  moderador: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * Resolve o staff autenticado para uma live (por auth_user_id ou email).
 * Retorna null se não houver usuário logado ou ele não for staff da live.
 *
 * A checagem usa o service role (admin client) porque precisa ler a tabela
 * `staff` de forma autoritativa após identificar o usuário do Auth.
 */
export async function getStaffContext(
  liveId: string
): Promise<StaffContext | null> {
  if (!isServiceRoleConfigured) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const admin = getAdminClient();
  // Busca o staff da live e casa por auth_user_id OU email em JS (evita
  // interpolar valores crus no filtro .or do PostgREST — B1 da auditoria).
  const emailLc = user.email.toLowerCase();
  const { data: todos } = await admin
    .from("staff")
    .select("id, papel, auth_user_id, email")
    .eq("live_id", liveId);
  const rows = (todos ?? []).filter(
    (r) => r.auth_user_id === user.id || (r.email ?? "").toLowerCase() === emailLc
  );

  if (rows.length === 0) return null;

  // Maior papel disponível.
  const melhor = rows
    .map((r) => r.papel as PapelStaff)
    .sort((a, b) => RANK[b] - RANK[a])[0];

  // Vincula auth_user_id na primeira vez (promovido só por email).
  const semVinculo = rows.find((r) => !r.auth_user_id);
  if (semVinculo) {
    await admin
      .from("staff")
      .update({ auth_user_id: user.id })
      .eq("id", semVinculo.id);
  }

  return { userId: user.id, email: user.email, papel: melhor, liveId };
}

export function temPapel(ctx: StaffContext, minimo: PapelStaff): boolean {
  return RANK[ctx.papel] >= RANK[minimo];
}
