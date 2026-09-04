import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Ortam değişkenleri tanımlı mı? */
export function hasSupabaseEnv(): boolean {
  return Boolean(URL && KEY);
}

const MISSING =
  "Supabase ortam değişkenleri eksik. NEXT_PUBLIC_SUPABASE_URL ve " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmalı. Yerelde web/.env.local, " +
  "Vercel'de Project Settings → Environment Variables.";

/**
 * Tarayıcı (Client Component) tarafı Supabase istemcisi.
 * Ortam değişkenleri yoksa açık bir hata fırlatır — sessizce yanlış
 * davranmaktansa sorunu göstermek daha iyi.
 */
export function createClient() {
  if (!URL || !KEY) throw new Error(MISSING);
  return createBrowserClient(URL, KEY);
}

/**
 * Herkese açık sayfalar için hoşgörülü sürüm: ortam değişkenleri yoksa
 * hata fırlatmak yerine null döner, sayfa boş durumla çalışmaya devam eder.
 */
export function createClientSafe() {
  if (!URL || !KEY) {
    if (process.env.NODE_ENV !== "production") console.warn("[supabase] " + MISSING);
    return null;
  }
  return createBrowserClient(URL, KEY);
}
