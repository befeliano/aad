/* ============================================================
   Mülakat soru ve beceri setleri.

   Departman seçilince o birime ait beceri tikleri ve açık uçlu sorular
   ekranda çıkar. Mülakatı yapan kişi telefondan doldurur.

   BURASI KODDA: yeni bir beceri eklemek şu an deploy gerektiriyor.
   Çok takımlı yapıya geçerken bu iki liste veritabanına alınacak
   (her takımın birimleri ve soruları farklı olacak).

   Departman anahtarları src/lib/constants.ts içindeki DEPT_KEYS ile
   birebir aynı olmalı — "sponsorluk" = Medya & Sponsorluk.
   ============================================================ */

/* ---------- Kayıt ---------- */

export type Durum = "planlandi" | "yapildi" | "kabul" | "red" | "beklemede";

export const DURUMLAR = [
  "planlandi",
  "yapildi",
  "kabul",
  "red",
  "beklemede",
] as const;

export const DURUM_META: Record<
  Durum,
  { etiket: string; tone: "neutral" | "info" | "ok" | "bad" | "warn" }
> = {
  planlandi: { etiket: "Planlandı", tone: "neutral" },
  yapildi: { etiket: "Görüşüldü", tone: "info" },
  kabul: { etiket: "Kabul", tone: "ok" },
  red: { etiket: "Red", tone: "bad" },
  beklemede: { etiket: "Beklemede", tone: "warn" },
};

/** Başvuru formundaki bir soru ve cevabı (formdaki sırayla saklanır) */
export interface FormCevap {
  soru: string;
  cevap: string;
}

/** public.interviews satırı — supabase/mulakat.sql + mulakat-form.sql */
export interface Mulakat {
  id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  program: string | null;
  email: string | null;
  phone: string | null;
  /** Form cevabı tanınmazsa boş kalabilir */
  dept: string | null;
  skills: string[];
  answers: Record<string, string>;
  score: number | null;
  notes: string | null;
  notes_version: number;
  status: Durum;
  source: "form" | "manuel";
  form_data: FormCevap[];
  submitted_at: string | null;
  interviewed_at: string | null;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
}

/** Mülakat notu üst sınırı — görüşme notu uzun olabiliyor */
export const NOT_SINIRI = 20000;

/**
 * Aynı notu iki kişi aynı anda düzenlediğinde otomatik birleştirme.
 *
 * Mülakatta not tutmak neredeyse hep SONA EKLEMEKTİR. İkimiz de aynı
 * metnin (taban) sonuna yazdıysak: tabana önce onun, sonra benim
 * eklediğimi koy. Biri metnin ortasını değiştirdiyse güvenli bir
 * birleştirme yok — null döner, kullanıcıya sorulur.
 */
export function notlariBirlestir(
  taban: string,
  benim: string,
  onlarin: string
): string | null {
  if (benim === onlarin) return benim;
  if (benim === taban) return onlarin;
  if (onlarin === taban) return benim;
  if (benim.startsWith(taban) && onlarin.startsWith(taban)) {
    const ek = benim.slice(taban.length);
    const ayrac = onlarin.endsWith("\n") || ek.startsWith("\n") ? "" : "\n";
    return onlarin + ayrac + ek;
  }
  return null;
}

/* ---------- Soru ve beceri setleri ---------- */

export interface Beceri {
  key: string;
  label: string;
}

export interface Soru {
  key: string;
  label: string;
  /** Uzun cevap alanı mı */
  uzun?: boolean;
}

/** Departmana bakmaksızın herkese sorulanlar */
export const GENEL_SORULAR: Soru[] = [
  {
    key: "genel_katki",
    label: "Takıma ne katabilirsin?",
    uzun: true,
  },
  {
    key: "genel_musaitlik",
    label:
      "Hafta sonu çalışmalarına katılabilir misin? (Cmt 10:00–17:00, yarışma döneminde Cmt + Paz)",
  },
  {
    key: "genel_beklenti",
    label: "Takımdan beklentin ne?",
  },
];

/** Birim → beceri tikleri */
export const BECERILER: Record<string, Beceri[]> = {
  yazilim: [
    { key: "python", label: "Python" },
    { key: "cpp", label: "C++" },
    { key: "c", label: "C" },
    { key: "web", label: "Web" },
    { key: "ros", label: "ROS" },
    { key: "goruntu_isleme", label: "Görüntü İşleme" },
    { key: "algoritma", label: "Algoritma Optimizasyonu" },
    { key: "uc_d", label: "3D Teknoloji" },
  ],
  tasarim: [
    { key: "solidworks", label: "SolidWorks" },
    { key: "fusion", label: "Fusion 360" },
    { key: "autocad", label: "AutoCAD" },
    { key: "catia", label: "CATIA" },
    { key: "cfd", label: "Ansys / CFD" },
    { key: "uc_d_baski", label: "3D Baskı" },
  ],
  sponsorluk: [
    { key: "youtube", label: "YouTube" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "foto_video", label: "Video & Fotoğraf" },
    { key: "montaj", label: "Montaj" },
    { key: "grafik", label: "Grafik Tasarım" },
    { key: "metin", label: "Metin Yazarlığı" },
  ],
  /* --- Aşağıdaki üçü taslak: kendi terimlerinizle düzeltin --- */
  kompozit: [
    { key: "vakum_infuzyon", label: "Vakum İnfüzyon" },
    { key: "elle_yatirma", label: "Elle Yatırma" },
    { key: "kalip", label: "Kalıp Yapımı" },
    { key: "karbon", label: "Karbon Fiber" },
    { key: "cam_elyaf", label: "Cam Elyaf" },
    { key: "yuzey", label: "Zımpara & Yüzey İşlemi" },
  ],
  yapisal: [
    { key: "lehim", label: "Lehim" },
    { key: "cnc", label: "CNC / Torna" },
    { key: "uc_d_baski_y", label: "3D Baskı" },
    { key: "montaj_y", label: "Montaj" },
    { key: "el_aleti", label: "El Aletleri" },
    { key: "olcum", label: "Ölçüm & Tolerans" },
  ],
  aviyonik: [
    { key: "lehimleme", label: "Lehimleme" },
    { key: "pcb", label: "PCB Tasarımı" },
    { key: "ardupilot", label: "ArduPilot / PX4" },
    { key: "telemetri", label: "Telemetri" },
    { key: "sensor", label: "Sensör Entegrasyonu" },
    { key: "guc", label: "Güç Dağıtımı" },
    { key: "kablolama", label: "Kablolama" },
  ],
};

/** Birim → o birime özel açık uçlu sorular */
export const SORULAR: Record<string, Soru[]> = {
  yazilim: [
    {
      key: "yazilim_eksik",
      label:
        "Takımın yazılım tarafında eksik gördüğün ilk şey ne olurdu, nasıl iyileştirirdin?",
      uzun: true,
    },
    {
      key: "yazilim_proje",
      label: "Şimdiye kadar yazdığın en karmaşık program neydi?",
      uzun: true,
    },
  ],
  tasarim: [
    {
      key: "tasarim_uretilebilirlik",
      label:
        "Bir parçayı tasarlarken üretilebilirliği nasıl gözetirsin? Örnek verebilir misin?",
      uzun: true,
    },
    {
      key: "tasarim_program",
      label: "Hangi programda kendini en rahat hissediyorsun, neden?",
    },
  ],
  sponsorluk: [
    {
      key: "medya_icerik",
      label:
        "Takımı sosyal medyada nasıl anlatırdın? Ne tür içerikler paylaşırdın?",
      uzun: true,
    },
    {
      key: "medya_sponsor",
      label: "Bir sponsora takımı anlatan nasıl bir sunum hazırlardın?",
      uzun: true,
    },
  ],
  kompozit: [
    {
      key: "kompozit_uretim",
      label: "Daha önce elinle bir şey ürettin mi? Anlat.",
      uzun: true,
    },
    {
      key: "kompozit_denge",
      label:
        "Ağırlık ile dayanım arasında seçim yapman gerekse nasıl karar verirsin?",
      uzun: true,
    },
  ],
  yapisal: [
    {
      key: "yapisal_kirik",
      label: "Uçakta bir parça kırıldığında ilk ne yaparsın?",
      uzun: true,
    },
    {
      key: "yapisal_guvenlik",
      label: "Atölyede çalışırken güvenlik açısından neye dikkat edersin?",
    },
  ],
  aviyonik: [
    {
      key: "aviyonik_teshis",
      label: "Çalışmayan bir devreyi nasıl teşhis edersin?",
      uzun: true,
    },
    {
      key: "aviyonik_lehim",
      label: "Hiç lehim yaptın mı? Ne yaptın?",
    },
  ],
};

/** Bir birim için tüm sorular: önce birime özel, sonra genel */
export function sorulariGetir(dept: string): Soru[] {
  return [...(SORULAR[dept] || []), ...GENEL_SORULAR];
}

/** Beceri anahtarından etiketi bul (listede yoksa anahtarı döndür) */
export function beceriEtiketi(dept: string, key: string): string {
  return (BECERILER[dept] || []).find((b) => b.key === key)?.label ?? key;
}
