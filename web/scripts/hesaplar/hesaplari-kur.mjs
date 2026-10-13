/* ============================================================
   Panel hesaplarını sıfırdan kurar.

   NE YAPAR
     1. uye-listesi.json'daki herkese hesap açar:
          e-posta: adsoyad@aad.com   (Türkçe harfler sadeleşir, boşluk yok)
          şifre  : soyadı + 4 rakam + işaret   (örn. sahin4817!)
        Rol, birim ve ad profillere yazılır.
     2. "korunan" listesindekiler (admin@anatolia.com) DIŞINDAKİ bütün
        hesapları siler. Korunan hesabın rolü "sistem" (Teknik Yönetici)
        olur — yetkisi aynı kalır, Takım Kaptanı unvanı Emin'e geçebilsin.
     3. Görevlerdeki "atanan kişi" bağlantısını yeni hesaplara yeniden
        bağlar (görevde yazan isim = yeni hesabın adı ise).
     4. Herkesin e-posta ve şifresini cikti/ klasörüne CSV olarak yazar.
        Bu klasör git'e girmez; dağıttıktan sonra dosyayı silin.

   SİLİNEN HESAPLARIN VERİSİ: görev, uçuş, mülakat notu gibi kayıtlar
   SİLİNMEZ; yalnızca "kim oluşturdu" alanları boşalır.

   ÖN KOŞUL
     - Supabase'de supabase/roller-danisman.sql çalıştırılmış olmalı.
     - web/.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve
       SUPABASE_SERVICE_ROLE_KEY olmalı (Vercel'deki değerin aynısı).

   ÇALIŞTIRMA (web klasöründen)
     node scripts/hesaplar/hesaplari-kur.mjs            → yalnızca PLANI gösterir
     node scripts/hesaplar/hesaplari-kur.mjs --uygula   → gerçekten yapar
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(BURASI, "..", "..");
const UYGULA = process.argv.includes("--uygula");
const ALAN = "aad.com";

const ROLLER = ["admin", "vice", "advisor", "mentor", "captain", "member"];
const BIRIMLER = ["yazilim", "tasarim", "yapisal", "aviyonik", "kompozit", "sponsorluk"];
const ROL_ADI = {
  admin: "Takım Kaptanı",
  vice: "Takım Kaptan Yardımcısı",
  advisor: "Danışman Hoca",
  mentor: "Danışman",
  captain: "Birim Kaptanı",
  member: "Üye",
};
const BIRIM_ADI = {
  yazilim: "Yazılım",
  tasarim: "Tasarım",
  yapisal: "Yapısal",
  aviyonik: "Aviyonik",
  kompozit: "Kompozit",
  sponsorluk: "Sosyal Medya & Sponsorluk",
};

/* ---------- ortam ---------- */
function envOku() {
  const env = { ...process.env };
  const dosya = path.join(WEB, ".env.local");
  if (existsSync(dosya)) {
    for (const satir of readFileSync(dosya, "utf8").split(/\r?\n/)) {
      const m = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/* ---------- ad → e-posta / şifre ---------- */
function sadelestir(s) {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const epostaOf = (ad) => `${sadelestir(ad)}@${ALAN}`;

function sifreOf(ad) {
  const soyad = sadelestir(ad.trim().split(/\s+/).pop());
  const rakam = String(randomInt(0, 10000)).padStart(4, "0");
  const isaret = "!?*#."[randomInt(0, 5)];
  return `${soyad}${rakam}${isaret}`;
}

function csvHucre(v) {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ---------- ana akış ---------- */
async function main() {
  const env = envOku();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "HATA: web/.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY olmalı."
    );
    process.exit(1);
  }

  const liste = JSON.parse(readFileSync(path.join(BURASI, "uye-listesi.json"), "utf8"));
  const korunan = new Set((liste.korunan || []).map((e) => e.toLowerCase()));

  /* Listeyi doğrula */
  const hedef = [];
  const gorulen = new Map();
  let hata = 0;
  for (const u of liste.uyeler) {
    if (!ROLLER.includes(u.rol)) { console.error(`Geçersiz rol: ${u.ad} → ${u.rol}`); hata++; }
    if (u.birim !== null && !BIRIMLER.includes(u.birim)) { console.error(`Geçersiz birim: ${u.ad} → ${u.birim}`); hata++; }
    const email = epostaOf(u.ad);
    if (gorulen.has(email)) { console.error(`Aynı e-posta iki kişiye çıktı: ${u.ad} / ${gorulen.get(email)} → ${email}`); hata++; }
    gorulen.set(email, u.ad);
    hedef.push({ ...u, email });
  }
  for (const r of ["admin", "vice"]) {
    const n = hedef.filter((u) => u.rol === r).length;
    if (n > 1) { console.error(`'${r}' rolü tek kişiye verilebilir, listede ${n} kişi var.`); hata++; }
  }
  if (hata) process.exit(1);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  /* Mevcut hesaplar */
  const mevcut = [];
  for (let sayfa = 1; ; sayfa++) {
    const { data, error } = await db.auth.admin.listUsers({ page: sayfa, perPage: 1000 });
    if (error) { console.error("Hesaplar okunamadı:", error.message); process.exit(1); }
    mevcut.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const kalan = mevcut.filter((u) => korunan.has((u.email || "").toLowerCase()));
  const silinecek = mevcut.filter((u) => !korunan.has((u.email || "").toLowerCase()));
  const eksikKorunan = [...korunan].filter((e) => !kalan.some((u) => u.email?.toLowerCase() === e));

  /* Plan */
  console.log("\n================ PLAN ================");
  // Supabase panelindeki adresle karşılaştırın:
  // supabase.com/dashboard/project/<BU KOD>/...
  console.log(`Supabase projesi: ${new URL(url).hostname.split(".")[0]}  (${url})`);
  console.log(`Mevcut hesap: ${mevcut.length}  (Supabase → Authentication → Users'taki "Total" ile aynı olmalı)`);
  console.log(`Korunacak  : ${kalan.map((u) => u.email).join(", ") || "(yok!)"}  → rolü "sistem" (Teknik Yönetici)`);
  if (eksikKorunan.length) console.log(`  UYARI: korunan listesinde olup bulunamayan: ${eksikKorunan.join(", ")}`);
  console.log(`Silinecek  : ${silinecek.length}`);
  for (const u of silinecek) console.log(`   - ${u.email}`);
  console.log(`Açılacak   : ${hedef.length}`);
  for (const r of ROLLER) {
    const grup = hedef.filter((u) => u.rol === r);
    if (!grup.length) continue;
    console.log(`   ${ROL_ADI[r]} (${grup.length}):`);
    for (const u of grup) {
      console.log(`      ${u.ad.padEnd(24)} ${u.email.padEnd(32)} ${u.birim ? BIRIM_ADI[u.birim] : ""}`);
    }
  }
  console.log("======================================\n");

  /* Korunacak hesap bulunamadıysa DUR: aksi halde panelde yönetici
     hesabı kalmadan her şey silinirdi. */
  if (kalan.length === 0) {
    console.error(
      "DURDU: korunacak hesap (admin@anatolia.com) bulunamadı. uye-listesi.json'daki 'korunan' alanını kontrol edin."
    );
    process.exit(1);
  }

  if (!UYGULA) {
    console.log("Bu yalnızca plandı, hiçbir şey değişmedi.");
    console.log("Uygulamak için:  node scripts/hesaplar/hesaplari-kur.mjs --uygula\n");
    return;
  }

  /* 1) Korunan hesap(lar) Teknik Yönetici olsun — tek Takım Kaptanı kuralı
        Emin'in admin olmasına izin versin. Rol kısıtı yeni rolü tanımıyorsa
        burada durur, henüz hiçbir şey silinmemiş olur. */
  for (const u of kalan) {
    const { error } = await db.from("profiles").update({ role: "sistem" }).eq("id", u.id);
    if (error) {
      console.error(`DURDU: ${u.email} rolü güncellenemedi (${error.message}).`);
      console.error("Önce Supabase'de supabase/roller-danisman.sql çalıştırın. Hiçbir hesap silinmedi.");
      process.exit(1);
    }
  }
  console.log(`✓ ${kalan.length} korunan hesap Teknik Yönetici yapıldı.`);

  /* 2) Diğer hesapları sil */
  const silinemeyen = [];
  for (const u of silinecek) {
    await db.from("profiles").delete().eq("id", u.id);
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) silinemeyen.push(`${u.email}: ${error.message}`);
  }
  console.log(`✓ ${silinecek.length - silinemeyen.length}/${silinecek.length} hesap silindi.`);
  for (const s of silinemeyen) console.log(`   ! ${s}`);

  /* 3) Yeni hesaplar */
  const sonuc = [];
  const acilamayan = [];
  for (const u of hedef) {
    const sifre = sifreOf(u.ad);
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: sifre,
      email_confirm: true,
      user_metadata: { full_name: u.ad },
    });
    if (error || !data.user) {
      acilamayan.push(`${u.ad} (${u.email}): ${error?.message}`);
      continue;
    }
    const { error: pErr } = await db.from("profiles").upsert(
      [
        {
          id: data.user.id,
          email: u.email,
          full_name: u.ad,
          username: u.email.split("@")[0],
          role: u.rol,
          department: u.birim,
        },
      ],
      { onConflict: "id" }
    );
    if (pErr) acilamayan.push(`${u.ad}: hesap açıldı ama profil yazılamadı — ${pErr.message}`);
    sonuc.push({ ...u, id: data.user.id, sifre });
  }
  console.log(`✓ ${sonuc.length}/${hedef.length} hesap açıldı.`);
  for (const s of acilamayan) console.log(`   ! ${s}`);

  /* 4) Görev atamalarını yeni hesaplara bağla (isim tam eşleşirse) */
  let baglanan = 0;
  for (const u of sonuc) {
    const { data } = await db
      .from("tasks")
      .update({ assignee_id: u.id })
      .eq("assignee", u.ad)
      .select("id");
    baglanan += data?.length ?? 0;
  }
  if (baglanan) console.log(`✓ ${baglanan} görev yeni hesaplara bağlandı.`);

  /* 5) Şifre listesi */
  const klasor = path.join(BURASI, "cikti");
  mkdirSync(klasor, { recursive: true });
  const dosya = path.join(klasor, `hesaplar-${new Date().toISOString().slice(0, 10)}.csv`);
  const satirlar = [
    ["Ad Soyad", "Birim", "Rol", "E-posta", "Şifre", "Not"],
    ...sonuc.map((u) => [
      u.ad,
      u.birim ? BIRIM_ADI[u.birim] : "",
      ROL_ADI[u.rol],
      u.email,
      u.sifre,
      u.not || "",
    ]),
  ];
  writeFileSync(dosya, "﻿" + satirlar.map((r) => r.map(csvHucre).join(";")).join("\r\n"));
  console.log(`\n✓ Şifre listesi: ${dosya}`);
  console.log("  Herkese kendi satırını özelden iletin; sonra bu dosyayı silin.");
  console.log("  Üyeler ilk girişte Profilim'den şifrelerini değiştirmeli.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
