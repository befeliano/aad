/* ============================================================
   security.ts — girdi doğrulama yardımcıları

   NOT: React, JSX içine konan tüm metni otomatik olarak escape eder;
   bu projede hiçbir yerde kullanıcı verisiyle dangerouslySetInnerHTML
   KULLANILMAZ. Buradaki yardımcılar React'in kapsamadığı yerler içindir:
   - href / src gibi URL bağlamları (javascript: ve data: enjeksiyonu)
   - dosya adları (path traversal)
   - metin uzunluk sınırları (DoS / kirli veri)
   ============================================================ */

/** href/src için güvenli olan protokoller */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Bir URL'i yalnızca güvenli protokoldeyse döndürür.
 * `javascript:`, `data:`, `vbscript:`, `blob:` vb. reddedilir.
 * Kullanıcının girdiği her bağlantı (medya external_url) bundan geçer.
 */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // Protokolsüz girilmişse https varsay
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(candidate);
    if (!SAFE_PROTOCOLS.has(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Yeni sekmede güvenli açar; güvensiz URL'de hiçbir şey yapmaz. */
export function openExternal(raw: string | null | undefined): boolean {
  const url = safeUrl(raw);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Depolama yolu için dosya uzantısını güvenli hale getirir.
 * Sadece harf/rakam, en fazla 8 karakter.
 */
export function safeExt(fileName: string): string {
  const raw = fileName.split(".").pop() || "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.slice(0, 8) || "bin";
}

/**
 * Görüntülenecek dosya adını temizler (path traversal ve kontrol
 * karakterlerini atar). İndirme `download` özniteliği için.
 */
export function safeFileName(name: string | null | undefined): string {
  if (!name) return "dosya";
  const cleaned = Array.from(name)
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      // Kontrol karakterlerini (U+0000–U+001F, U+007F) at
      return c > 0x1f && c !== 0x7f;
    })
    .join("")
    .replace(/[/\\]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || "dosya";
}

/** Metni kırpar ve baştaki/sondaki boşlukları atar; boşsa null. */
export function trimTo(
  raw: FormDataEntryValue | null | undefined,
  max: number
): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, max);
  return s || null;
}

/** Zorunlu metin alanı — boşsa boş string döner (form doğrulaması çağıran tarafta). */
export function reqText(
  raw: FormDataEntryValue | null | undefined,
  max: number
): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/** Sayıyı güvenli aralığa sıkıştırır; geçersizse fallback. */
export function safeNumber(
  raw: FormDataEntryValue | null | undefined,
  { min = 0, max = 1e12, fallback = 0 } = {}
): number {
  const n = Number(typeof raw === "string" ? raw.replace(",", ".") : raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Değerin izin verilen kümede olduğunu doğrular (enum alanları için).
 * Böylece istemciden uydurma bir `dept`/`status` gönderilemez.
 */
export function oneOf<T extends string>(
  raw: FormDataEntryValue | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const s = typeof raw === "string" ? raw : "";
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/** Alan uzunluk sınırları — tek yerden yönetilir */
export const LIMITS = {
  title: 200,
  name: 200,
  shortText: 300,
  longText: 5000,
  payload: 20000,
  url: 2000,
} as const;
