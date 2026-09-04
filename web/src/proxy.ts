import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: `middleware` convention'ı `proxy` olarak yeniden adlandırıldı.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar hariç tüm rotalar:
     * _next, favicon, resim/medya/font uzantıları atlanır.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|woff2?)$).*)",
  ],
};
