import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Servis anahtarlı istemci — RLS'i ATLAR.
 *
 * Yalnızca oturumu olmayan sunucu-sunucu çağrıları için: şu an tek
 * kullanıcısı Google Form webhook'u (api/mulakat/form). Kullanıcı
 * isteğine cevap veren hiçbir yerde kullanmayın; orada server.ts'teki
 * oturumlu istemci RLS'i uygular.
 *
 * SUPABASE_SERVICE_ROLE_KEY'in başında NEXT_PUBLIC_ YOK: tarayıcıya
 * asla gönderilmez. "server-only" bu dosya bir Client Component'e
 * girerse build'i durdurur.
 *
 * Değişken tanımlı değilse null döner; çağıran taraf 503 verir.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
