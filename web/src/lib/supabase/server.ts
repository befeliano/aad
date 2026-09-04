import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Sunucu (Server Component / Route Handler / Server Action) tarafı istemci.
 * Cookie tabanlı session okur; auth guard ve SSR veri çekimi için kullanılır.
 */
export async function createClient() {
  // cookies() ÖNCE çağrılmalı: bu çağrı rotayı dinamik olarak işaretler.
  // Env kontrolünü öne alırsak Next.js rotayı statik sanıp build sırasında
  // prerender etmeye çalışır ve hata fırlatır.
  const cookieStore = await cookies();

  if (!URL || !KEY) {
    throw new Error(
      "Supabase ortam değişkenleri eksik. NEXT_PUBLIC_SUPABASE_URL ve " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmalı. Yerelde web/.env.local, " +
        "Vercel'de Project Settings → Environment Variables."
    );
  }

  return createServerClient(
    URL,
    KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden set edilirse yok sayılır;
            // session yenileme middleware'de yapılır.
          }
        },
      },
    }
  );
}
