/* ============================================================
   Google Form başvurusu → mülakat kaydı

   Webhook (src/app/api/mulakat/form/route.ts) formdan gelen soru-cevap
   listesini buradan geçirir. Eşleştirme SORU BAŞLIĞINA göre yapılır:
   "Adınız ve Soyadınız", "Telefon Numaranız", "Hangi birimde çalışmak
   istersiniz?" vb. Formda başlık değişirse kunyeAlani()'ndaki kalıpları
   güncelleyin — eşleşmeyen soru kaybolmaz, aday sayfasında "Formdaki
   cevaplar" altında görünmeye devam eder.

   Saf fonksiyonlar: hem sunucuda (webhook) hem tarayıcıda (aday sayfası
   künye sorularını listeden ayıklarken) çalışır.
   ============================================================ */

import { DEPT_KEYS } from "@/lib/constants";
import type { FormCevap } from "@/lib/interview";

export type KunyeAlani =
  | "ad_soyad"
  | "ad"
  | "soyad"
  | "eposta"
  | "telefon"
  | "dogum"
  | "yas"
  | "bolum"
  | "birim";

const SORU_SINIRI = 500;
const CEVAP_SINIRI = 5000;
const EN_FAZLA_SORU = 100;

/** Türkçe karakterleri sadeleştirir, küçük harfe indirir, noktalamayı boşluk yapar */
export function sadelestir(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Soru başlığı künye alanlarından birine mi karşılık geliyor?
 *
 * Yalnızca KISA ve soru eki taşımayan başlıklar künye sayılır:
 * "Bölümünüzde yaptığınız projelerden bahseder misiniz?" gibi açık uçlu
 * bir soru "bölüm" kelimesi geçiyor diye programın yerine yazılmasın.
 * (Formdaki en uzun künye başlığı: "Hangi birimde çalışmak istersiniz?")
 */
export function kunyeAlani(soru: string): KunyeAlani | null {
  const t = sadelestir(soru).split(" ").filter(Boolean);
  if (t.length === 0 || t.length > 5) return null;
  if (t.some((w) => /^m[iu](s[iu]n([iu]z)?)?$/.test(w) || w.startsWith("bahse")))
    return null;
  const bas = (...on: string[]) => t.some((w) => on.some((o) => w.startsWith(o)));
  const tam = (...k: string[]) => t.some((w) => k.includes(w));

  if (bas("eposta", "mail") || sadelestir(soru).includes("e posta"))
    return "eposta";
  if (bas("telefon", "gsm") || tam("tel", "cep")) return "telefon";
  if (bas("dogum")) return "dogum";

  const soyad = bas("soyad", "soyisim");
  const ad = tam("ad", "adi", "adin", "adiniz", "isim", "ismi", "isminiz");
  if (ad && soyad) return "ad_soyad";
  if (soyad) return "soyad";
  if (ad) return "ad";

  if (tam("yas", "yasiniz", "yasin")) return "yas";
  if (bas("bolum", "universite")) return "bolum";
  if (bas("birim", "departman")) return "birim";
  return null;
}

/** Formdaki birim cevabını DEPT_KEYS anahtarına çevirir */
export function birimAnahtari(cevap: string): string | null {
  const s = sadelestir(cevap);
  const kaliplar: [RegExp, string][] = [
    [/aviyonik/, "aviyonik"],
    [/yazilim/, "yazilim"],
    [/yapisal/, "yapisal"],
    [/kompozit/, "kompozit"],
    [/sponsor|medya/, "sponsorluk"],
    [/tasarim|analiz/, "tasarim"],
  ];
  const bulunan = kaliplar.find(([re]) => re.test(s))?.[1] ?? null;
  return bulunan && (DEPT_KEYS as readonly string[]).includes(bulunan)
    ? bulunan
    : null;
}

/** "ahmet yılmaz" gibi tamamı küçük yazılmış ismi baş harf büyük yapar */
function isimDuzelt(s: string): string {
  const temiz = s.replace(/\s+/g, " ").trim();
  if (temiz !== temiz.toLocaleLowerCase("tr")) return temiz;
  return temiz
    .split(" ")
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}

/** "Ali Can Yılmaz" → ["Ali Can", "Yılmaz"] */
export function adSoyadAyir(tamAd: string): [string, string] {
  const parcalar = isimDuzelt(tamAd).split(" ").filter(Boolean);
  if (parcalar.length === 0) return ["", ""];
  if (parcalar.length === 1) return [parcalar[0], ""];
  return [parcalar.slice(0, -1).join(" "), parcalar[parcalar.length - 1]];
}

/**
 * Doğum tarihinden yaş. Google Forms tarih sorusu Apps Script'e
 * "2004-05-12" verir; Sheets üzerinden gelirse "12.05.2004" olabilir.
 * Türkçe sıra (gün.ay.yıl) varsayılır.
 */
export function yasHesapla(dogum: string, bugun: Date): number | null {
  const s = dogum.trim();
  let y: number, m: number, d: number;
  let e = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (e) {
    [y, m, d] = [Number(e[1]), Number(e[2]), Number(e[3])];
  } else {
    e = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (!e) return null;
    [d, m, y] = [Number(e[1]), Number(e[2]), Number(e[3])];
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  let yas = bugun.getFullYear() - y;
  const ayFark = bugun.getMonth() + 1 - m;
  if (ayFark < 0 || (ayFark === 0 && bugun.getDate() < d)) yas--;
  // Tablodaki kısıtla aynı aralık (mulakat.sql)
  return yas >= 15 && yas <= 70 ? yas : null;
}

/** Görüntüleme: "5321234567" → "0532 123 45 67" */
export function telefonGoster(tel: string): string {
  const r = tel.replace(/\D/g, "");
  const on = r.length === 10 && r.startsWith("5") ? "0" + r : r;
  if (on.length === 11 && on.startsWith("05")) {
    return `${on.slice(0, 4)} ${on.slice(4, 7)} ${on.slice(7, 9)} ${on.slice(9)}`;
  }
  return tel;
}

/** tel: bağlantısı — Türkiye cep numarasıysa +90 ile */
export function telefonBaglantisi(tel: string): string {
  const r = tel.replace(/\D/g, "");
  if (r.length === 10 && r.startsWith("5")) return `tel:+90${r}`;
  if (r.length === 11 && r.startsWith("05")) return `tel:+9${r}`;
  if (r.length === 12 && r.startsWith("905")) return `tel:+${r}`;
  return `tel:${r}`;
}

function metne(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(metne).filter(Boolean).join(", ");
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/**
 * Gelen gövdedeki cevapları tek biçime indirir. Kabul edilen şekiller:
 *   - Apps Script (bu projedeki):  [{ "question": "...", "answer": "..." }]
 *   - Sheets onFormSubmit:          { "Soru": ["cevap"] }   (namedValues)
 *   - Make / Zapier düz nesnesi:    { "Soru": "cevap" }
 * Boş cevaplar atlanır; uzunluklar kırpılır.
 */
export function cevaplariTopla(ham: unknown): FormCevap[] | null {
  let ciftler: [unknown, unknown][];
  if (Array.isArray(ham)) {
    ciftler = ham.map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return [o.question ?? o.soru ?? o.title, o.answer ?? o.cevap ?? o.response];
    });
  } else if (ham && typeof ham === "object") {
    ciftler = Object.entries(ham as Record<string, unknown>);
  } else {
    return null;
  }

  const sonuc: FormCevap[] = [];
  for (const [s, c] of ciftler) {
    const soru = metne(s).slice(0, SORU_SINIRI);
    const cevap = metne(c).slice(0, CEVAP_SINIRI);
    if (!soru || !cevap) continue;
    sonuc.push({ soru, cevap });
    if (sonuc.length >= EN_FAZLA_SORU) break;
  }
  return sonuc;
}

export interface FormKaydi {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  program: string | null;
  age: number | null;
  dept: string | null;
  form_data: FormCevap[];
}

/** Soru-cevap listesinden interviews satırının künye alanlarını çıkarır */
export function formuCoz(
  cevaplar: FormCevap[],
  opts: { gonderenEposta?: string | null; gonderimAni: Date }
): FormKaydi {
  const k: FormKaydi = {
    first_name: "",
    last_name: "",
    email: null,
    phone: null,
    program: null,
    age: null,
    dept: null,
    form_data: cevaplar,
  };

  for (const { soru, cevap } of cevaplar) {
    switch (kunyeAlani(soru)) {
      case "ad_soyad":
        if (!k.first_name) [k.first_name, k.last_name] = adSoyadAyir(cevap);
        break;
      case "ad":
        if (!k.first_name) k.first_name = isimDuzelt(cevap);
        break;
      case "soyad":
        if (!k.last_name) k.last_name = isimDuzelt(cevap);
        break;
      case "eposta":
        k.email ??= cevap.slice(0, 200);
        break;
      case "telefon":
        k.phone ??= cevap.slice(0, 40);
        break;
      case "dogum":
        k.age ??= yasHesapla(cevap, opts.gonderimAni);
        break;
      case "yas": {
        const n = parseInt(cevap, 10);
        if (k.age === null && n >= 15 && n <= 70) k.age = n;
        break;
      }
      case "bolum":
        k.program ??= cevap.slice(0, 200);
        break;
      case "birim":
        k.dept ??= birimAnahtari(cevap);
        break;
    }
  }

  // Formda "E-posta adreslerini topla" açıksa e-posta soru olarak değil,
  // yanıtın kendisinde gelir.
  if (!k.email && opts.gonderenEposta) {
    k.email = opts.gonderenEposta.trim().slice(0, 200) || null;
  }
  if (!k.first_name) k.first_name = "İsimsiz aday";
  return k;
}
