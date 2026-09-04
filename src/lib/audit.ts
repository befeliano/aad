import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction = "create" | "update" | "delete" | "login";

/**
 * Denetim kaydı yazar. Hata durumunda sessizce geçer — log tutulamadı diye
 * asıl işlemi bozmak istemiyoruz. RLS log yazmayı engelliyorsa da sorun olmaz.
 *
 * Not: audit_log tablosuna user_name/user_dept alanlarını sunucu tarafındaki
 * trigger dolduruyorsa buradaki alanlar yok sayılır.
 */
export async function logAction(
  supabase: SupabaseClient,
  action: AuditAction,
  tableName: string | null,
  recordId: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from("audit_log").insert([
      {
        action,
        table_name: tableName,
        record_id: recordId,
        details,
      },
    ]);
  } catch {
    /* yoksay */
  }
}
