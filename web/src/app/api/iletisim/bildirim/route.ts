import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEAM } from "@/lib/constants";

/* ============================================================
   /api/iletisim/bildirim — iletişim formu mesajlarını takım mailine

   Sitedeki form mesajı doğrudan veritabanına yazar (Gelen Kutusu).
   Mail atma işi Google Apps Script'te (scripts/google-iletisim.gs):

     GET  → mail atılmamış mesajlar (en eski 20) + takım adresi
     POST { ids: [...] } → bu mesajlar gönderildi, işaretle

   İşaret mail GİTTİKTEN sonra konur: betik yarıda kalırsa mesaj
   bir sonraki turda yeniden gelir, kaybolmaz.

   Kimlik doğrulama: Authorization: Bearer <anahtar>
     anahtar = YOKLAMA_SECRET, yoksa MULAKAT_WEBHOOK_SECRET
     (aynı Apps Script projesi zaten bu anahtarı biliyor).
   ============================================================ */

const EN_FAZLA = 20;

function cevap(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function anahtarDogru(gelen: string | null, beklenen: string): boolean {
  if (!gelen) return false;
  const a = createHash("sha256").update(gelen).digest();
  const b = createHash("sha256").update(beklenen).digest();
  return timingSafeEqual(a, b);
}

function yetki(request: Request) {
  const secret =
    process.env.YOKLAMA_SECRET || process.env.MULAKAT_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || secret.length < 16 || !admin) {
    return {
      hata: cevap(503, {
        ok: false,
        hata:
          "Yapılandırılmamış: MULAKAT_WEBHOOK_SECRET ve SUPABASE_SERVICE_ROLE_KEY tanımlanmalı.",
      }),
    };
  }
  const y = request.headers.get("authorization") ?? "";
  const gelen = y.startsWith("Bearer ") ? y.slice(7).trim() : null;
  if (!anahtarDogru(gelen, secret)) {
    return { hata: cevap(401, { ok: false, hata: "Yetkisiz." }) };
  }
  return { admin };
}

export async function GET(request: Request) {
  const { admin, hata } = yetki(request);
  if (hata) return hata;

  const { data, error } = await admin!
    .from("contact_messages")
    .select("id, name, email, subject, message, created_at")
    .is("mailed_at", null)
    .order("created_at")
    .limit(EN_FAZLA);

  if (error) {
    // mailed_at kolonu yoksa: iletisim-mail.sql çalıştırılmamış
    return cevap(500, { ok: false, hata: error.message });
  }
  return cevap(200, {
    ok: true,
    alici: TEAM.email,
    adres: new URL("/panel/mesajlar", request.url).toString(),
    mesajlar: data ?? [],
  });
}

export async function POST(request: Request) {
  const { admin, hata } = yetki(request);
  if (hata) return hata;

  let ids: string[] = [];
  try {
    const g = (await request.json()) as { ids?: unknown };
    ids = Array.isArray(g.ids)
      ? g.ids.filter((x): x is string => typeof x === "string").slice(0, 100)
      : [];
  } catch {
    return cevap(400, { ok: false, hata: "Geçersiz JSON." });
  }
  if (ids.length === 0) return cevap(400, { ok: false, hata: "ids boş." });

  const { error } = await admin!
    .from("contact_messages")
    .update({ mailed_at: new Date().toISOString() })
    .in("id", ids)
    .is("mailed_at", null);
  if (error) return cevap(500, { ok: false, hata: error.message });
  return cevap(200, { ok: true, isaretlenen: ids.length });
}
