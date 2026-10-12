import type { SupabaseClient } from "@supabase/supabase-js";
import {
  YOKLAMA_BASLANGIC,
  calismaGunleri,
  type GunKaydi,
  type GunKurali,
} from "@/lib/takvim";

/**
 * Bir birimin yoklaması alınmamış çalışma günleri (eskiden yeniye).
 *
 * Takvimdeki uyarı ve paneldeki bildirim zili bunu kullanır; e-posta
 * hatırlatması (api/yoklama/eksikler) aynı kuralı sunucuda uygular.
 * Birimde üye yoksa ya da tablo kurulu değilse boş döner.
 */
export async function eksikYoklamaGunleri(
  supabase: SupabaseClient,
  dept: string,
  bugun: string
): Promise<string[]> {
  /* Birim × gün satırları zamanla 1000'i (PostgREST sınırı) aşar */
  const alinan = new Set<string>();
  for (let i = 0; ; i += 1000) {
    const { data, error } = await supabase
      .from("attendance")
      .select("day")
      .eq("dept", dept)
      .gte("day", YOKLAMA_BASLANGIC)
      .lte("day", bugun)
      .order("day")
      .range(i, i + 999);
    if (error) return [];
    for (const x of (data as { day: string }[]) || []) alinan.add(x.day);
    if (!data || data.length < 1000) break;
  }

  const [{ data: g }, { data: r }, { count }] = await Promise.all([
    supabase
      .from("calendar_days")
      .select("day, kind")
      .gte("day", YOKLAMA_BASLANGIC)
      .lte("day", bugun),
    supabase.from("calendar_rules").select("*").eq("active", true),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("department", dept),
  ]);
  if (!count) return [];

  const gunler: Record<string, GunKaydi> = {};
  for (const x of (g as GunKaydi[]) || []) gunler[x.day] = x;
  return calismaGunleri(
    YOKLAMA_BASLANGIC,
    bugun,
    gunler,
    (r as GunKurali[]) || []
  ).filter((k) => !alinan.has(k));
}
