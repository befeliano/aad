/* ============================================================
   Çalışma takvimi — ortak gün hesabı

   Bir günün türü iki kaynaktan gelir:
     calendar_days  : elle girilmiş gün (kuralı EZER)
     calendar_rules : tekrar eden kural (her cmt 10:00–17:00 …)

   Takvim ekranı, yoklama paneli ve yoklama hatırlatma e-postası aynı
   kuralı kullanmalı; yoksa "bugün çalışma var mı" sorusuna farklı
   yerler farklı cevap verir.
   ============================================================ */

export type GunTuru = "calisma" | "tatil" | "etkinlik" | "yarisma";

export interface GunKaydi {
  day: string;
  kind: GunTuru;
}

export interface GunKurali {
  weekdays: number[];
  kind: GunTuru;
  valid_from: string;
  valid_to: string | null;
  active?: boolean;
}

/**
 * Yoklama bu tarihten itibaren beklenir. Daha eski günler için
 * hatırlatma gitmez — sistem kurulmadan önceki günleri kaptandan istemek
 * anlamsız.
 */
export const YOKLAMA_BASLANGIC = "2026-10-12";

/* Beş durum. "Mazeretli" = hastalık ya da geçerli mazeret (haber verdi);
   katılım oranında paydaya girmez. DB kısıtı: duzeltmeler-ekim.sql */
export const YOKLAMA_DURUMLARI = ["geldi", "gec", "erken", "mazeretli", "gelmedi"] as const;
export type YoklamaDurumu = (typeof YOKLAMA_DURUMLARI)[number];

export const YOKLAMA_ETIKET: Record<YoklamaDurumu, string> = {
  geldi: "Geldi",
  gec: "Geç geldi",
  erken: "Erken ayrıldı",
  mazeretli: "Mazeretli",
  gelmedi: "Gelmedi",
};

/** Katılım oranında "geldi" sayılanlar */
export const YOKLAMA_KATILDI: readonly YoklamaDurumu[] = ["geldi", "gec", "erken"];

/** Yerel saate göre YYYY-MM-DD — toISOString() UTC'ye kaydırıp günü şaşırtır */
export function gunAnahtari(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Türkiye saatine göre bugünün anahtarı — sunucu UTC'de çalışsa da doğru */
export function bugunTR(simdi = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(simdi);
}

/** ISO gün numarası: 1=Pazartesi … 7=Pazar */
function isoGun(k: string): number {
  const g = new Date(k + "T12:00:00Z").getUTCDay();
  return g === 0 ? 7 : g;
}

/** Günün türü; kayıt da kural da yoksa null */
export function gunTuru(
  k: string,
  gunler: Record<string, GunKaydi>,
  kurallar: GunKurali[]
): GunTuru | null {
  const elle = gunler[k];
  if (elle) return elle.kind;
  const iso = isoGun(k);
  const kural = kurallar.find(
    (r) =>
      r.active !== false &&
      r.weekdays.includes(iso) &&
      k >= r.valid_from &&
      (!r.valid_to || k <= r.valid_to)
  );
  return kural?.kind ?? null;
}

/** [bas, bit] aralığındaki çalışma günleri, eskiden yeniye */
export function calismaGunleri(
  bas: string,
  bit: string,
  gunler: Record<string, GunKaydi>,
  kurallar: GunKurali[]
): string[] {
  const sonuc: string[] = [];
  const d = new Date(bas + "T12:00:00Z");
  const son = new Date(bit + "T12:00:00Z");
  while (d <= son) {
    const k = d.toISOString().slice(0, 10);
    if (gunTuru(k, gunler, kurallar) === "calisma") sonuc.push(k);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return sonuc;
}
