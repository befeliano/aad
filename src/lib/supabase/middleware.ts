import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Her istekte Supabase session'ını tazeler ve /panel altını korur.
 *
 * Ortam değişkenleri tanımlı değilse (ör. Vercel'de env girilmeden yapılan
 * ilk deploy) burada hata fırlatmak TÜM siteyi 500'e düşürürdü. Bunun yerine
 * herkese açık sayfalar normal çalışır, /panel ise girişe yönlendirilir —
 * yani env eksikken panel açıkta kalmaz.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!URL || !KEY) {
    if (path.startsWith("/panel")) {
      const url = request.nextUrl.clone();
      url.pathname = "/giris";
      url.searchParams.set("hata", "yapilandirma");
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /panel altı yalnızca giriş yapmışlara açık
  if (!user && path.startsWith("/panel")) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Giriş yapmış kullanıcı /giris'e gelirse panele yönlendir
  if (user && path === "/giris") {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url);
  }

  return response;
}
