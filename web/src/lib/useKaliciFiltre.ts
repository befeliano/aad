"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/* ============================================================
   useKaliciFiltre — sayfadan çıkıp dönünce kaybolmayan filtre

   Kullanıcı geri bildirimi: "Mülakatta Tasarım'ı ya da Uçuşlar'da
   Simülasyon'u seçip başka sekmeye gidince, döndüğümde filtre gitmiş."

   useState gibi kullanılır:
     const [birim, setBirim] = useKaliciFiltre("mulakat.birim", "");

   Değer önce bellekte (panel içi gezinmede sayfa yeniden kurulsa da
   modül yaşar), sonra sessionStorage'da tutulur (sayfa yenilense de
   kalır; sekme kapanınca sıfırlanır). Gizli sekmede storage atarsa
   bellek yine çalışır.

   useSyncExternalStore: sunucuda ve ilk hidrasyonda varsayılan değer
   döner, böylece SSR çıktısıyla uyuşmazlık olmaz.
   ============================================================ */

const ONEK = "aad:filtre:";
const bellek = new Map<string, string>();
const dinleyiciler = new Set<() => void>();

function abone(cb: () => void) {
  dinleyiciler.add(cb);
  return () => {
    dinleyiciler.delete(cb);
  };
}

function oku(anahtar: string): string | null {
  const b = bellek.get(anahtar);
  if (b !== undefined) return b;
  try {
    return sessionStorage.getItem(ONEK + anahtar);
  } catch {
    return null;
  }
}

function coz<T>(ham: string | null, varsayilan: T): T {
  if (ham === null) return varsayilan;
  try {
    return JSON.parse(ham) as T;
  } catch {
    return varsayilan;
  }
}

type Ayarla<T> = (v: T | ((onceki: T) => T)) => void;

/* Aşırı yüklemeler: varsayılan "" ise tip "" değil string olsun.
   Dar bir birleşim tip isteniyorsa açıkça verilir:
     useKaliciFiltre<"upcoming" | "past">("ucuslar.tab", "upcoming") */
export function useKaliciFiltre(
  anahtar: string,
  varsayilan: boolean
): [boolean, Ayarla<boolean>];
export function useKaliciFiltre<T extends string = string>(
  anahtar: string,
  varsayilan: NoInfer<T>
): [T, Ayarla<T>];
export function useKaliciFiltre<T extends string | boolean>(
  anahtar: string,
  varsayilan: T
): [T, Ayarla<T>] {
  const ham = useSyncExternalStore(
    abone,
    () => oku(anahtar),
    () => null
  );
  const deger = useMemo(() => coz(ham, varsayilan), [ham, varsayilan]);

  const ayarla = useCallback(
    (v: T | ((onceki: T) => T)) => {
      const onceki = coz(oku(anahtar), varsayilan);
      const yeni = typeof v === "function" ? (v as (o: T) => T)(onceki) : v;
      const metin = JSON.stringify(yeni);
      bellek.set(anahtar, metin);
      try {
        if (yeni === varsayilan) sessionStorage.removeItem(ONEK + anahtar);
        else sessionStorage.setItem(ONEK + anahtar, metin);
      } catch {
        // storage kapalı: bellek yeterli
      }
      dinleyiciler.forEach((f) => f());
    },
    [anahtar, varsayilan]
  );

  return [deger, ayarla];
}
