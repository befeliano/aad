/* ============================================================
   Birim renkleri — takvim notları ve işlerinde

   Not, yazanın biriminin renginde görünür; "herkes" hedefli not
   (duyuru) altın sarısıdır. Tailwind sınıfı yerine düz renk: sınıf
   adları çalışma anında üretilince derlemeye girmiyor.
   ============================================================ */

export const BIRIM_RENK: Record<string, string> = {
  yazilim: "#E0453A", // nar çiçeği
  yapisal: "#2E9E5B", // yeşil
  tasarim: "#7B61FF", // mor
  aviyonik: "#2F80ED", // mavi
  kompozit: "#E8862A", // turuncu
  sponsorluk: "#D6458F", // pembe
  ortak: "#8A94A6", // gri
};

/** Herkese açık not (duyuru) */
export const DUYURU_RENK = "#C9A227";

/** Bir notun rengi: herkes → duyuru, yoksa yazanın birimi */
export function notRengi(hedef: string[], yazanBirim: string | null): string {
  if (hedef.includes("herkes")) return DUYURU_RENK;
  return (yazanBirim && BIRIM_RENK[yazanBirim]) || BIRIM_RENK[hedef[0]] || BIRIM_RENK.ortak;
}
