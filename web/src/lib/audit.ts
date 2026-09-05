import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction = "create" | "update" | "delete" | "login";

/**
 * Denetim kaydı yazar.
 *
 * DİKKAT: supabase-js hata durumunda THROW ETMEZ, `{ error }` döndürür.
 * Eski sürüm bunu yalnızca try/catch ile sarmaladığı için başarısız
 * insert'ler tamamen sessizce kayboluyordu — panelde günlerce yeni kayıt
 * görünmemesinin sebebi buydu. Artık dönen hata kontrol ediliyor.
 *
 * Log yazılamaması asıl işlemi bozmaz (false döner, hata fırlatmaz), ama
 * geliştirmede konsola yazılır ki sorun fark edilsin.
 */
export async function logAction(
  supabase: SupabaseClient,
  action: AuditAction,
  tableName: string | null,
  recordId: string | null,
  details: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    /* audit_insert_self politikası `auth.uid() = user_id` şartını arıyor.
       user_id gönderilmezse NULL kalır, karşılaştırma NULL döner ve kayıt
       sessizce reddedilir — bu alanı MUTLAKA dolduruyoruz.
       getSession() yereldeki oturumu okur, ağ isteği yapmaz. */
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return false;

    const { error } = await supabase.from("audit_log").insert([
      {
        user_id: userId,
        action,
        table_name: tableName,
        record_id: recordId,
        details,
      },
    ]);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[audit] "${action}" kaydı yazılamadı:`,
          error.message,
          error.details ?? "",
          error.hint ?? ""
        );
      }
      return false;
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[audit] beklenmeyen hata:", e);
    }
    return false;
  }
}
