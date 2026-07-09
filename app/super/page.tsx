import type { Metadata } from "next";
import { getSuperAdmin } from "@/lib/super";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { SuperConsole } from "@/components/super-console";

export const metadata: Metadata = { title: "Dummy Live · Super-admin" };

export default async function SuperPage() {
  const ctx = isServiceRoleConfigured ? await getSuperAdmin() : null;
  return (
    <SuperConsole
      autorizado={!!ctx}
      email={ctx?.email ?? null}
      semBanco={!isServiceRoleConfigured}
    />
  );
}
