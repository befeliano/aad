import type { StockItem } from "@/lib/types";

/* ============================================================
   Envanter sağlık durumu — miktar, SKT ve şarj döngüsü
   Kaptan yardımcısının isteği: SKT'ye 1 ay kala uyarı.
   ============================================================ */

export const EXPIRY_WARN_DAYS = 30;

export type StockStatus = "out" | "critical" | "expired" | "expiring" | "worn" | "ok";

export const STATUS_META: Record<
  StockStatus,
  { label: string; tone: "bad" | "warn" | "ok"; short: string }
> = {
  out:      { label: "Tükendi",        tone: "bad",  short: "Tükendi" },
  expired:  { label: "SKT Geçti",      tone: "bad",  short: "SKT geçti" },
  worn:     { label: "Ömrünü Doldurdu",tone: "bad",  short: "Ömür doldu" },
  critical: { label: "Kritik Stok",    tone: "warn", short: "Kritik" },
  expiring: { label: "SKT Yaklaşıyor", tone: "warn", short: "SKT yakın" },
  ok:       { label: "Yeterli",        tone: "ok",   short: "Yeterli" },
};

/** Bugüne göre kaç gün kaldı (geçmişse negatif) */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(+d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((+d - +today) / 86400000);
}

/**
 * Bir malzemenin durumu. Öncelik sırası en kötüden iyiye:
 * tükendi > SKT geçti > ömrü doldu > kritik stok > SKT yaklaşıyor > yeterli
 */
export function statusOf(s: StockItem): StockStatus {
  const qty = Number(s.qty);
  const min = Number(s.min_stock || 0);

  if (qty <= 0) return "out";

  const days = daysUntil(s.expiry_date);
  if (days !== null && days < 0) return "expired";

  const cc = Number(s.cycle_count || 0);
  const cl = Number(s.cycle_limit || 0);
  if (cl > 0 && cc >= cl) return "worn";

  if (qty <= min) return "critical";
  if (days !== null && days <= EXPIRY_WARN_DAYS) return "expiring";

  // Döngü limitinin %90'ını geçtiyse de uyar
  if (cl > 0 && cc >= cl * 0.9) return "expiring";

  return "ok";
}

/** Uyarı gerektiren kalemler (panel ana sayfası için) */
export function needsAttention(items: StockItem[]): StockItem[] {
  const rank: Record<StockStatus, number> = {
    out: 0, expired: 1, worn: 2, critical: 3, expiring: 4, ok: 9,
  };
  return items
    .filter((s) => statusOf(s) !== "ok")
    .sort((a, b) => {
      const d = rank[statusOf(a)] - rank[statusOf(b)];
      if (d !== 0) return d;
      const da = daysUntil(a.expiry_date) ?? 9999;
      const db = daysUntil(b.expiry_date) ?? 9999;
      return da - db;
    });
}

/** Durumu insan diline çevirir — "12 gün kaldı", "3 gün geçti" */
export function expiryText(s: StockItem): string | null {
  const days = daysUntil(s.expiry_date);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} gün geçti`;
  if (days === 0) return "Bugün doluyor";
  return `${days} gün kaldı`;
}
