import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cevaplariTopla, formuCoz } from "@/lib/interview-form";

/* ============================================================
   POST /api/mulakat/form — başvuru formu webhook'u

   Google Form doldurulunca Apps Script (scripts/google-form-mulakat.gs)
   buraya gönderir, Mülakatlar'da yeni aday sayfası açılır.
   Make.com / Zapier'den de aynı şekilde çağrılabilir.

   Kimlik doğrulama: Authorization: Bearer <MULAKAT_WEBHOOK_SECRET>

   Gövde:
     {
       "response_id":      "Google yanıt kimliği (tekrar gönderimde aynı)",
       "submitted_at":     "2026-10-01T12:34:56.000Z",
       "respondent_email": "form e-posta topluyorsa",
       "answers": [{ "question": "Adınız ve Soyadınız", "answer": "..." }, ...]
     }
   "answers" yerine { "Soru": "cevap" } nesnesi de kabul edilir.

   Aynı response_id ikinci kez gelirse kayıt AÇILMAZ ve mevcut satıra
   dokunulmaz — tümünü yeniden göndermek (tumunuGonder) güvenlidir,
   mülakat notları ezilmez.
   ============================================================ */

/** Gövde sınırı — 16 soruluk başvuru ~10 KB tutuyor */
const GOVDE_SINIRI = 200_000;

function cevap(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Sabit sürede karşılaştırma — anahtarı zamanlama farkıyla tahmin ettirmez */
function anahtarDogru(gelen: string | null, beklenen: string): boolean {
  if (!gelen) return false;
  const a = createHash("sha256").update(gelen).digest();
  const b = createHash("sha256").update(beklenen).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.MULAKAT_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || secret.length < 16 || !admin) {
    return cevap(503, {
      ok: false,
      hata:
        "Webhook yapılandırılmamış: MULAKAT_WEBHOOK_SECRET (en az 16 karakter) " +
        "ve SUPABASE_SERVICE_ROLE_KEY tanımlanmalı.",
    });
  }

  const yetki = request.headers.get("authorization") ?? "";
  const gelen = yetki.startsWith("Bearer ") ? yetki.slice(7).trim() : null;
  if (!anahtarDogru(gelen, secret)) {
    return cevap(401, { ok: false, hata: "Yetkisiz." });
  }

  const metin = await request.text();
  if (metin.length > GOVDE_SINIRI) {
    return cevap(413, { ok: false, hata: "Gövde çok büyük." });
  }

  let govde: Record<string, unknown>;
  try {
    const j: unknown = JSON.parse(metin);
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error();
    govde = j as Record<string, unknown>;
  } catch {
    return cevap(400, { ok: false, hata: "Geçersiz JSON." });
  }

  const cevaplar = cevaplariTopla(
    govde.answers ?? govde.cevaplar ?? govde.namedValues
  );
  if (!cevaplar || cevaplar.length === 0) {
    return cevap(400, { ok: false, hata: "Cevap listesi boş." });
  }

  const zamanHam =
    typeof govde.submitted_at === "string" ? Date.parse(govde.submitted_at) : NaN;
  const gonderimAni = Number.isFinite(zamanHam) ? new Date(zamanHam) : new Date();

  const kayit = formuCoz(cevaplar, {
    gonderenEposta:
      typeof govde.respondent_email === "string" ? govde.respondent_email : null,
    gonderimAni,
  });

  // Kimlik gelmezse (Make/Zapier) içerikten türet: aynı gönderimin tekrarı
  // yine tek kayıt olur.
  const responseId =
    typeof govde.response_id === "string" && govde.response_id.trim()
      ? govde.response_id.trim().slice(0, 200)
      : "icerik:" +
        createHash("sha256")
          .update(JSON.stringify([govde.submitted_at ?? null, cevaplar]))
          .digest("hex")
          .slice(0, 40);

  const { data, error } = await admin
    .from("interviews")
    .upsert(
      [
        {
          ...kayit,
          source: "form",
          form_response_id: responseId,
          submitted_at: gonderimAni.toISOString(),
          status: "planlandi",
        },
      ],
      { onConflict: "form_response_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[mulakat webhook] kaydedilemedi:", error.message);
    return cevap(500, { ok: false, hata: "Kaydedilemedi: " + error.message });
  }

  const yeni = (data?.length ?? 0) > 0;
  return cevap(yeni ? 201 : 200, {
    ok: true,
    yeni,
    id: data?.[0]?.id ?? null,
    aday: `${kayit.first_name} ${kayit.last_name}`.trim(),
  });
}
