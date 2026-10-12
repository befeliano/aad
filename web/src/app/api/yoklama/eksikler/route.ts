import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import {
  YOKLAMA_BASLANGIC,
  bugunTR,
  calismaGunleri,
  type GunKaydi,
  type GunKurali,
} from "@/lib/takvim";

/* ============================================================
   GET /api/yoklama/eksikler — yoklaması alınmamış günler

   "Birim kaptanı yoklama almazsa alana kadar her gün mail atılacak."

   E-postayı Google Apps Script gönderiyor (scripts/google-yoklama.gs):
   her akşam buraya sorar, dönen her kaptana Gmail'den hatırlatma atar.
   Böylece SMTP ayarı, alan adı ya da ek paket gerekmiyor; başvuru
   formu için kurulan Apps Script projesine bir dosya eklemek yetiyor.

   Kimlik doğrulama: Authorization: Bearer <anahtar>
     anahtar = YOKLAMA_SECRET, tanımlı değilse MULAKAT_WEBHOOK_SECRET
     (aynı Apps Script projesi zaten bu anahtarı biliyor).

   Yanıt:
     { tarih, adres, kaptanlar: [{ email, ad, birim, birimAdi, gunler }],
       kaptansiz: [{ birim, birimAdi, gunler }] }
   "Eksik gün" = YOKLAMA_BASLANGIC'tan bugüne çalışma günü olup birim
   için HİÇ yoklama satırı olmayan gün (kısmen alınmış sayılır).
   Üyesi olmayan birim atlanır.
   ============================================================ */

function anahtarDogru(gelen: string | null, beklenen: string): boolean {
  if (!gelen) return false;
  const a = createHash("sha256").update(gelen).digest();
  const b = createHash("sha256").update(beklenen).digest();
  return timingSafeEqual(a, b);
}

function cevap(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

interface Profil {
  email: string | null;
  full_name: string | null;
  username: string | null;
  role: string;
  department: string | null;
}

export async function GET(request: Request) {
  const secret =
    process.env.YOKLAMA_SECRET || process.env.MULAKAT_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || secret.length < 16 || !admin) {
    return cevap(503, {
      ok: false,
      hata:
        "Yapılandırılmamış: YOKLAMA_SECRET (ya da MULAKAT_WEBHOOK_SECRET) " +
        "ve SUPABASE_SERVICE_ROLE_KEY tanımlanmalı.",
    });
  }

  const yetki = request.headers.get("authorization") ?? "";
  const gelen = yetki.startsWith("Bearer ") ? yetki.slice(7).trim() : null;
  if (!anahtarDogru(gelen, secret)) {
    return cevap(401, { ok: false, hata: "Yetkisiz." });
  }

  const bugun = bugunTR();

  /* Sezon boyunca yoklama satırı 1000'i (PostgREST üst sınırı) aşar:
     sayfa sayfa oku */
  const yoklamaOku = async () => {
    const satirlar: { day: string; dept: string }[] = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await admin
        .from("attendance")
        .select("day, dept")
        .gte("day", YOKLAMA_BASLANGIC)
        .lte("day", bugun)
        .order("day")
        .range(i, i + 999);
      if (error) return { data: null, error };
      satirlar.push(...((data as typeof satirlar) || []));
      if (!data || data.length < 1000) return { data: satirlar, error: null };
    }
  };

  const [gunR, kuralR, yoklamaR, profilR] = await Promise.all([
    admin
      .from("calendar_days")
      .select("day, kind")
      .gte("day", YOKLAMA_BASLANGIC)
      .lte("day", bugun),
    admin.from("calendar_rules").select("*").eq("active", true),
    yoklamaOku(),
    admin.from("profiles").select("email, full_name, username, role, department"),
  ]);

  const hata = gunR.error || kuralR.error || yoklamaR.error || profilR.error;
  if (hata) {
    console.error("[yoklama eksikler]", hata.message);
    return cevap(500, { ok: false, hata: hata.message });
  }

  const gunler: Record<string, GunKaydi> = {};
  for (const g of (gunR.data as GunKaydi[]) || []) gunler[g.day] = g;
  const calisma = calismaGunleri(
    YOKLAMA_BASLANGIC,
    bugun,
    gunler,
    (kuralR.data as GunKurali[]) || []
  );

  const alinan = new Set(
    (yoklamaR.data || []).map((y) => `${y.dept}|${y.day}`)
  );
  const profiller = (profilR.data as Profil[]) || [];

  const kaptanlar: Record<string, unknown>[] = [];
  const kaptansiz: Record<string, unknown>[] = [];

  for (const birim of DEPT_KEYS) {
    const uyeSayisi = profiller.filter((p) => p.department === birim).length;
    if (uyeSayisi === 0) continue;

    const eksik = calisma.filter((k) => !alinan.has(`${birim}|${k}`));
    if (eksik.length === 0) continue;

    const birimAdi = DEPT_LABELS[birim] || birim;
    const kaptan = profiller.filter(
      (p) => p.role === "captain" && p.department === birim && p.email
    );
    if (kaptan.length === 0) {
      kaptansiz.push({ birim, birimAdi, gunler: eksik });
      continue;
    }
    for (const k of kaptan) {
      kaptanlar.push({
        email: k.email,
        ad: k.full_name?.trim() || k.username?.trim() || "",
        birim,
        birimAdi,
        gunler: eksik,
      });
    }
  }

  return cevap(200, {
    ok: true,
    tarih: bugun,
    adres: new URL("/panel/takvim", request.url).toString(),
    kaptanlar,
    kaptansiz,
  });
}
