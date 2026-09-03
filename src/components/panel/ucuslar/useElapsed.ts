"use client";

import { useEffect, useSyncExternalStore } from "react";

/* ============================================================
   Saat, React'in dışında bir kaynaktır → useSyncExternalStore.
   Süre SAYILMAZ, başlangıç zaman damgasından HESAPLANIR: telefon
   ekranı kapandığında veya sekme arka plana atıldığında tarayıcı
   zamanlayıcıları kısar; sayaç tutan bir çözüm geri dönüldüğünde
   geride kalırdı, zaman damgası farkı ise her zaman doğrudur.
   ============================================================ */

const TICK_MS = 250;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, TICK_MS);
  // Arka plandan dönüşte anında doğru değere sıçra
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}

/** TICK_MS'e yuvarlanmış zaman — iki tick arasında sabit kalır */
const getSnapshot = () => Math.floor(Date.now() / TICK_MS);

/** Sunucuda saat yok; 0 döndürüp hidrasyona kadar süreyi gizliyoruz */
const getServerSnapshot = () => 0;

/** Verilen başlangıçtan bu yana geçen süre (saniye) */
export function useElapsed(startedAt: string | null | undefined): number {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!startedAt || tick === 0) return 0;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, (tick * TICK_MS - start) / 1000);
}

/** saniye → "1:23:45" ya da "12:34" */
export function formatElapsed(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Ekranın sahada kapanmaması için Wake Lock.
 * Desteklenmeyen tarayıcılarda sessizce hiçbir şey yapmaz.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type Sentinel = { release: () => Promise<void> };
    let lock: Sentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<Sentinel> };
        };
        if (!nav.wakeLock) return;
        const l = await nav.wakeLock.request("screen");
        if (cancelled) {
          l.release().catch(() => {});
          return;
        }
        lock = l;
      } catch {
        /* izin verilmedi ya da desteklenmiyor — sorun değil */
      }
    };

    request();
    // Sekmeye dönüldüğünde kilit düşmüş olabilir, yeniden iste
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
