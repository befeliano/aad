import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEPT_KEYS, DEPT_LABELS, LEADERSHIP_ROLES } from "@/lib/constants";
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
       kaptansiz: [{ birim, birimAdi, gunler }],
       epostasiz: [{ ad, birim, birimAdi, gunler }] }
   E-posta, kaptanın Profilim'e yazdığı bildirim adresine gider
   (notification_prefs); giriş adresi kullanılmaz, çoğu gerçek kutu değil.
   Adresi olmayan kaptan "epostasiz"da döner; panel zilinde yine görür.
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
  id: string;
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

  const [gunR, kuralR, yoklamaR, profilR, epostaR] = await Promise.all([
    admin
      .from("calendar_days")
      .select("day, kind")
      .gte("day", YOKLAMA_BASLANGIC)
      .lte("day", bugun),
    admin.from("calendar_rules").select("*").eq("active", true),
    yoklamaOku(),
    admin.from("profiles").select("id, full_name, username, role, department"),
    // Gerçek bildirim adresleri (Profilim). Tablo henüz yoksa boş sayılır.
    admin.from("notification_prefs").select("user_id, email"),
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
  const eposta = new Map(
    ((epostaR.data as { user_id: string; email: string | null }[]) || [])
      .filter((n) => n.email)
      .map((n) => [n.user_id, n.email as string])
  );

  const kaptanlar: Record<string, unknown>[] = [];
  const kaptansiz: Record<string, unknown>[] = [];
  /** Kaptan var ama Profilim'e bildirim e-postası yazmamış */
  const epostasiz: Record<string, unknown>[] = [];

  for (const birim of DEPT_KEYS) {
    const uyeSayisi = profiller.filter((p) => p.department === birim).length;
    if (uyeSayisi === 0) continue;

    const eksik = calisma.filter((k) => !alinan.has(`${birim}|${k}`));
    if (eksik.length === 0) continue;

    const birimAdi = DEPT_LABELS[birim] || birim;
    /* Sorumlu: birim kaptanı; birimde kaptan yoksa o birime kayıtlı
       tam yetkili kişi (ör. Sosyal Medya'yı yöneten kaptan yardımcısı).
       Panel tarafında aynı kural: lib/yoklama.ts yoklamaSorumlusuMu */
    let kaptan = profiller.filter(
      (p) => p.role === "captain" && p.department === birim
    );
    if (kaptan.length === 0) {
      kaptan = profiller.filter(
        (p) =>
          (LEADERSHIP_ROLES as readonly string[]).includes(p.role) &&
          p.department === birim
      );
    }
    if (kaptan.length === 0) {
      kaptansiz.push({ birim, birimAdi, gunler: eksik });
      continue;
    }
    for (const k of kaptan) {
      const ad = k.full_name?.trim() || k.username?.trim() || "";
      const adres = eposta.get(k.id);
      if (!adres) {
        epostasiz.push({ ad, birim, birimAdi, gunler: eksik });
        continue;
      }
      kaptanlar.push({
        email: adres,
        ad,
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
    epostasiz,
  });
}
