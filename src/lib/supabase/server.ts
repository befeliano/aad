import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Sunucu (Server Component / Route Handler / Server Action) tarafı istemci.
 * Cookie tabanlı session okur; auth guard ve SSR veri çekimi için kullanılır.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
