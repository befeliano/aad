import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { LEADERSHIP_ROLES } from "@/lib/constants";

export interface SessionInfo {
  userId: string;
  email: string | null;
  profile: Profile | null;
  /** Kaptan VEYA başkan yardımcısı — yetkileri eşittir (DB: is_admin()) */
  isAdmin: boolean;
  /** Yalnızca unvanı doğru göstermek için */
  role: string;
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

  await tazeleSonGorulme(supabase, user.id, profile?.last_seen ?? null);

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
    isAdmin: LEADERSHIP_ROLES.includes(
      (profile?.role ?? "") as (typeof LEADERSHIP_ROLES)[number]
    ),
    role: profile?.role ?? "member",
    dept: profile?.department ?? "",
  };
}

/** last_seen'i bu süreden eskiyse tazeler */
const SON_GORULME_ARALIGI_MS = 5 * 60 * 1000;

/**
 * "Son görülme" damgasını günceller.
 *
 * Bu alan uygulamada HİÇ yazılmıyordu; Üye Yönetimi'nde görünen tarihler
 * eski siteden kalma ölü verilerdi. getSession() her panel isteğinde
 * çalıştığı için her seferinde yazmıyoruz — yalnızca damga 5 dakikadan
 * eskiyse tazeliyoruz.
 *
 * RLS: profiles_update_self (auth.uid() = id) izin veriyor.
 * Tetikleyici: profiles_guard_privilege yalnızca role/department/email
 * değişimini engelliyor, last_seen serbest.
 */
async function tazeleSonGorulme(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sonGorulme: string | null
): Promise<void> {
  const oncekiMs = sonGorulme ? Date.parse(sonGorulme) : 0;
  if (Number.isFinite(oncekiMs) && Date.now() - oncekiMs < SON_GORULME_ARALIGI_MS) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", userId);

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[son görülme] güncellenemedi:", error.message);
  }
}

/** Bir modüle erişim kontrolü (RLS ile birlikte ikinci katman) */
export function canAccess(
  session: SessionInfo,
  opts: {
    allowedDepts?: string[];
    adminOnly?: boolean;
    /**
     * TAM rol eşleşmesi. Verilirse "kaptan her yere girer" kısayolu
     * DEVRE DIŞI kalır — İşlem Kayıtları gibi kaptan yardımcısına bile
     * kapalı olması istenen sayfalar için.
     * allowedDepts ile birlikte kullanılırsa ikisi VEYA'lanır.
     */
    exactRoles?: string[];
  }
): boolean {
  if (opts.exactRoles) {
    if (opts.exactRoles.includes(session.role)) return true;
    return !!opts.allowedDepts?.includes(session.dept);
  }
  if (session.isAdmin) return true;
  if (opts.adminOnly) return false;
  if (!opts.allowedDepts || opts.allowedDepts.length === 0) return true;
  return opts.allowedDepts.includes(session.dept);
}
