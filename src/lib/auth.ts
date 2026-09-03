import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionInfo {
  userId: string;
  email: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  dept: string;
}

/**
 * Sunucu tarafında oturum + profil bilgisini getirir.
 * Panel layout ve sayfalarında guard için kullanılır.
 */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
    isAdmin: profile?.role === "admin",
    dept: profile?.department ?? "",
  };
}

/** Bir modüle erişim kontrolü (RLS ile birlikte ikinci katman) */
export function canAccess(
  session: SessionInfo,
  opts: { allowedDepts?: string[]; adminOnly?: boolean }
): boolean {
  if (session.isAdmin) return true;
  if (opts.adminOnly) return false;
  if (!opts.allowedDepts || opts.allowedDepts.length === 0) return true;
  return opts.allowedDepts.includes(session.dept);
}
