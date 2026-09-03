import { createBrowserClient } from "@supabase/ssr";

/**
 * Tarayıcı (Client Component) tarafı Supabase istemcisi.
 * Realtime, auth ve storage için client bileşenlerde kullanılır.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
