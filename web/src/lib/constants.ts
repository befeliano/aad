/* ============================================================
   Paylaşılan sabitler — departmanlar, filo, başarılar
   ============================================================ */

export const TEAM = {
  name: "Anatolia Aero Design",
  fullName: "ESTÜ Anatolia Aero Design",
  tagline: "İnsansız Hava Aracı Ekibi",
  university: "Eskişehir Teknik Üniversitesi",
  address:
    "Gazipaşa Mah. ESTÜ İki Eylül Kampüsü, Proje Takımları Binası, Tepebaşı / Eskişehir",
  email: "anatoliaaerodesign@gmail.com",
  instagram: "anatoliaaerodesign",
  instagramUrl: "https://instagram.com/anatoliaaerodesign",
  youtubeUrl: "https://youtube.com/@anatoliaaerodesign",
  tiktokUrl: "https://tiktok.com/@anatoliaaerodesign",
  linkedinUrl: "https://linkedin.com/company/anatolia-aero-design/",
  /** Tanıtım dosyası: 2011'de kuruldu, 14 yıllık usta-çırak geleneği */
  founded: "2011",
  memberCount: "40",
  alumniCount: "46+",
  branchCount: "12",
};

/** Takım yönetimi — tanıtım/sponsorluk dosyasındaki iletişim bilgileri */
export interface TeamLead {
  name: string;
  role: string;
  email?: string;
}

export const TEAM_LEADS: TeamLead[] = [
  {
    name: "Selman KOÇ",
    role: "Takım Kaptanı",
    email: "selman_koc@outlook.com.tr",
  },
  {
    name: "Emre KOŞAR",
    role: "Takım Kaptan Yardımcısı",
    email: "emrekosar@ogr.eskisehir.edu.tr",
  },
];

/** Akademik danışmanlar */
export const ADVISORS = [
  { name: "Dr. Öğr. Üyesi Emre ÖZBEK", role: "Danışman" },
  { name: "Ar. Gör. Mustafa AZER", role: "Danışman" },
  { name: "Dr. İbrahim Yavuz DAL", role: "Danışman Pilot" },
];

/** 2026 hedef yarışma */
export const COMPETITION_2026 = {
  name: "TEKNOFEST Savaşan İHA",
  subtitle: "TÜBİTAK Uluslararası İHA Yarışması",
  location: "Şanlıurfa",
  date: "Ağustos – Eylül 2026",
  highlights: [
    {
      t: "Tam Otonom Uçuş",
      d: "İHA'lar kalkıştan inişe kadar tüm uçuş manevralarını hiçbir manuel müdahale olmadan kendi yazılımlarıyla gerçekleştirir.",
    },
    {
      t: "Hava Muharebesi ve Kilitlenme",
      d: "Rakip İHA'lar havada otonom olarak tespit edilir, başarıyla kilitlenir ve elde edilen kilit paketi anlık olarak yarışma sunucusuna gönderilir.",
    },
    {
      t: "Görev Başarısı ve Puanlama",
      d: "Bir hafta süren final maratonunda görevleri başarıyla tamamlayıp en yüksek puanı toplayan takım şampiyon olur.",
    },
  ],
};

export interface SocialLink {
  key: "instagram" | "youtube" | "tiktok" | "linkedin";
  label: string;
  handle: string;
  url: string;
}

export const SOCIALS: SocialLink[] = [
  { key: "instagram", label: "Instagram", handle: "@anatoliaaerodesign", url: TEAM.instagramUrl },
  { key: "youtube", label: "YouTube", handle: "@anatoliaaerodesign", url: TEAM.youtubeUrl },
  { key: "tiktok", label: "TikTok", handle: "@anatoliaaerodesign", url: TEAM.tiktokUrl },
  { key: "linkedin", label: "LinkedIn", handle: "Anatolia Aero Design", url: TEAM.linkedinUrl },
];

/**
 * Departman anahtarları.
 * NOT: Bunlar Supabase'deki mevcut `profiles.department` değerleridir —
 * RLS ve kayıtlı veriler buna bağlı olduğu için DEĞİŞTİRİLMEDİ.
 * "Tasarım" alt ekibi `tasarim` anahtarıyla eklendi.
 * Medya ve Sponsorluk tek ekip olduğu için tek anahtarda birleştirildi.
 * Anahtar `sponsorluk` OLARAK KALDI çünkü sponsors/allocations tablolarının
 * RLS politikaları `has_dept_access(ARRAY['sponsorluk'])` çağırıyor — anahtarı
 * değiştirmek finans erişimini kırardı. Etiket "Medya & Sponsorluk".
 * Eski `medya` kayıtlarının taşınması supabase/departman-birlestir.sql ile.
 */
export type DeptKey =
  | "yazilim"
  | "yapisal"
  | "aviyonik"
  | "kompozit"
  | "sponsorluk"
  | "tasarim"
  | "ortak";

/** Panelde gösterilen rol unvanları */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Takım Kaptanı",
  vice: "Takım Kaptan Yardımcısı",
  captain: "Birim Kaptanı",
  member: "Üye",
};

/**
 * Tam yetkili roller — DB'deki is_admin() ile birebir aynı küme olmalı.
 *
 * DİKKAT: "captain" (birim kaptanı) BURAYA GİRMEZ. Birim kaptanı olmak
 * finans gibi kritik verilere erişim vermez; yetkileri düz üye ile aynıdır,
 * "Birim Kaptanı" yalnızca unvandır.
 */
export const LEADERSHIP_ROLES = ["admin", "vice"] as const;

export const DEPT_LABELS: Record<string, string> = {
  yazilim: "Yazılım",
  yapisal: "Yapısal",
  aviyonik: "Aviyonik",
  kompozit: "Kompozit",
  sponsorluk: "Medya & Sponsorluk",
  tasarim: "Tasarım",
  ortak: "Ortak",
};

export const DEPT_KEYS: DeptKey[] = [
  "yazilim",
  "tasarim",
  "yapisal",
  "aviyonik",
  "kompozit",
  "sponsorluk",
];

/* ---------- BAŞARILAR (Instagram profilinden doğrulandı) ---------- */
export interface Achievement {
  year: string;
  title: string;
  detail: string;
  rank: string;
  highlight?: boolean;
  scope: "ulusal" | "uluslararasi";
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    year: "2022",
    title: "TEKNOFEST Savaşan İHA",
    detail: "Türkiye Şampiyonluğu",
    rank: "1.",
    highlight: true,
    scope: "ulusal",
  },
  {
    year: "2018",
    title: "TEKNOFEST TÜBİTAK İHA",
    detail: "Türkiye birinciliği",
    rank: "1.",
    highlight: true,
    scope: "ulusal",
  },
  {
    year: "2017",
    title: "SAE Aero Design East (ABD)",
    detail: "Dünya Şampiyonluğu — Jaeger ile",
    rank: "1.",
    highlight: true,
    scope: "uluslararasi",
  },
  { year: "2022", title: "TEKNOFEST Karma Sürü Simülasyon", detail: "Üçüncülük", rank: "3.", scope: "ulusal" },
  { year: "2021", title: "TEKNOFEST Savaşan İHA", detail: "İkincilik", rank: "2.", scope: "ulusal" },
  { year: "2020", title: "TEKNOFEST Sürü İHA", detail: "İkincilik", rank: "2.", scope: "ulusal" },
  { year: "2019", title: "TEKNOFEST TÜBİTAK İHA", detail: "Beşincilik", rank: "5.", scope: "ulusal" },
  { year: "2016", title: "SAE Aero Design", detail: "Genel sıralamada üçüncülük", rank: "3.", scope: "uluslararasi" },
  { year: "2015", title: "Future Flight Design", detail: "Genel sıralamada ikincilik", rank: "2.", scope: "uluslararasi" },
  { year: "2014", title: "SAE Aero Design", detail: "Genel sıralamada altıncılık", rank: "6.", scope: "uluslararasi" },
  { year: "2013", title: "SAE Aero Design", detail: "On birincilik", rank: "11.", scope: "uluslararasi" },
];

export const TAKIM_ISTATISTIK = {
  kurulus: "2011",
  uye: "40",
  mezun: "46+",
  sampiyonluk: "3x",
};

/* ---------- DEPARTMANLAR ---------- */
export interface Department {
  key: string;
  num: string;
  name: string;
  short: string;
  desc: string;
  detail: string;
}

export const DEPARTMENTS: Department[] = [
  {
    key: "yazilim",
    num: "01",
    name: "Yazılım",
    short: "Software",
    desc: "Otonom uçuş yazılımları, görüntü işleme ve yapay zekâ.",
    detail:
      "Otonom uçuş yazılımları, görüntü işleme ve yapay zekâ üzerine çalışmalar yürütür. Güdüm algoritmaları, hedef takibi ve yer kontrol istasyonu bu ekipten çıkar.",
  },
  {
    key: "tasarim",
    num: "02",
    name: "Tasarım",
    short: "Design",
    desc: "Uçağın tasarımı ve komponent tasarımları.",
    detail:
      "Uçağın genel tasarımı ve komponent tasarımları üzerinde çalışmalarını yürütür. Aerodinamik form, CAD modelleme ve simülasyon doğrulaması bu ekibin sorumluluğunda.",
  },
  {
    key: "kompozit",
    num: "03",
    name: "Kompozit",
    short: "Composites",
    desc: "Vakum infüzyon ve elle yatırma ile kompozit üretim.",
    detail:
      "Vakum infüzyon ve elle yatırma yöntemi ile kompozit parça üretimini gerçekleştirir. Karbon fiber ve cam elyaf ile hafif, dayanıklı gövde parçaları üretir.",
  },
  {
    key: "aviyonik",
    num: "04",
    name: "Aviyonik",
    short: "Avionics",
    desc: "Uçak elektroniği ve otopilot entegrasyonu.",
    detail:
      "Uçak elektroniği ve otopilot entegrasyonu alanında çalışmalar yapar. Sensör füzyonu, güç dağıtımı ve telemetri altyapısı bu ekipte kurulur.",
  },
  {
    key: "yapisal",
    num: "05",
    name: "Yapısal",
    short: "Structures",
    desc: "Komponent üretimi, tamir ve birleştirme.",
    detail:
      "Komponent üretimi, tamir ve birleştirilmesi gibi çalışmalar yapar. Montaj süreçleri ve saha bakımı bu ekibin sorumluluğunda.",
  },
  {
    key: "medya",
    num: "06",
    name: "Medya ve Sponsorluk",
    short: "Media & Partnerships",
    desc: "Tanıtım, sosyal medya ve sponsorluk ilişkileri.",
    detail:
      "Takımı sosyal medyada tanıtır, reklam için gerekli eylemleri gerçekleştirir ve sponsorluklarla ilgilenir. Kurumsal ilişkiler ve bütçe yönetimi de bu ekipte.",
  },
];

/* ---------- FİLO ---------- */
export interface Aircraft {
  name: string;
  /** public/images/fleet/<slug>.jpg dosyasıyla eşleşir */
  slug: string;
  /** Kart üzerinde küçük etiket — yıl ya da dönem */
  codename: string;
  role: string;
  desc: string;
  year: string;
  specs: { label: string; value: string }[];
  features?: { t: string; d: string }[];
  flagship?: boolean;
  /** harpy-golge-hydra.svg içindeki kırpma kutusu (596×843 koordinat alanı) */
  sprite?: { top: number; left: number; width: number; height: number };
}

/** Üç uçağın tek dosyada durduğu vektör sayfa */
export const FLEET_SPRITE = {
  src: "/harpy-golge-hydra.svg",
  viewW: 596,
  viewH: 843,
};

export const FLEET: Aircraft[] = [
  {
    name: "DABAN",
    slug: "daban",
    codename: "2027",
    role: "Savaşan İHA · Amiral Gemisi",
    desc: "2027 Savaşan İHA platformumuz. Geçmiş yılların tecrübesini daha agresif ve dayanıklı bir tasarımla birleştiren, çift motorlu ve tam otonom savaş İHA'sı. Geniş gövde hacmi sayesinde gelişmiş sensör füzyonu ve yapay zekâ algoritmalarını taşıyabiliyor.",
    flagship: true,
    year: "2027",
    specs: [
      { label: "Kanat Açıklığı", value: "2.6 m" },
      { label: "Kalkış Ağırlığı", value: "8 kg" },
      { label: "Uzunluk", value: "1.85 m" },
      { label: "Uçuş Süresi", value: "30 dk" },
      { label: "Seyir Sürati", value: "17 m/s" },
      { label: "Motor", value: "2× T-Motor AT3520" },
      { label: "Kamera", value: "Hikrobot MV CS050" },
      { label: "Uçuş Kontrol", value: "CUAV V6X" },
    ],
    features: [
      {
        t: "Çift Motor Konfigürasyonu",
        d: "Yüksek hızlarda ani manevra kabiliyeti ve sistem yedekliliği. Dogfight sırasında hız ve tırmanma avantajı sağlar.",
      },
      {
        t: "Gelişmiş Gövde ve Geniş Hacim",
        d: "Aerodinamik verimlilikten ödün vermeden daha karmaşık aviyonik sistemleri ve yüksek performanslı işlem birimlerini barındırır.",
      },
      {
        t: "Üstün Otonomi",
        d: "Gelişmiş sensör füzyonu ile çok daha hassas hedef takibi ve tamamen otonom görev icrası.",
      },
    ],
  },
  {
    name: "GÖLGE",
    slug: "golge",
    sprite: { top: 264, left: 100, width: 403, height: 219 },
    codename: "2020 – 2025",
    role: "Savaşan İHA · Türkiye Şampiyonu",
    desc: "2022 TEKNOFEST Savaşan İHA yarışmasında ekibimize Türkiye Şampiyonluğu getiren platform. Ters V-kuyruk mimarisi ve yüksek manevra kabiliyetiyle it dalaşı senaryolarında rekabetçi. Proje 2025'te tamamlandı.",
    year: "2020–2025",
    specs: [
      { label: "Mimari", value: "Ters V-Kuyruk" },
      { label: "Görev", value: "Hava-Hava Muharebe" },
      { label: "Otonomi", value: "Tam Otonom" },
      { label: "Başarı", value: "Türkiye 1.'si" },
    ],
  },
  {
    name: "MERLIN",
    slug: "merlin",
    codename: "2025 –",
    role: "Sabit Kanat · Faydalı Yük",
    desc: "Uluslararası İHA Yarışması kriterlerine göre tasarlanan Merlin, yüksek yük kapasitesini modüler mimariyle birleştirir. Kompakt taşıma kutusuna sığar ve 1 dakika 46 saniyede uçuşa hazır hale gelir.",
    year: "2025–",
    specs: [
      { label: "Kurulum", value: "1 dk 46 sn" },
      { label: "Hedef Yük Oranı", value: "2.5× kendi ağırlığı" },
      { label: "Yapı", value: "Modüler" },
      { label: "Görev", value: "Otonom Yük Bırakma" },
    ],
  },
  {
    name: "JAEGER",
    slug: "jaeger",
    codename: "2017",
    role: "SAE AERO DESIGN · Dünya Şampiyonu",
    desc: "2017'de ABD'de düzenlenen SAE Aero Design East yarışmasında Dünya Şampiyonluğu getiren, doğadan ilham alan (biyomimetik) modüler tasarım. 55 saniyelik montaj süresiyle tasarım disiplinimizin temel taşı.",
    year: "2017",
    specs: [
      { label: "Gövde Ağırlığı", value: "305 g" },
      { label: "Faydalı Yük", value: "1287 g" },
      { label: "Verimlilik", value: "3.1× boş ağırlık" },
      { label: "Montaj", value: "55 saniye" },
    ],
  },
  {
    name: "DORJE",
    slug: "dorje",
    codename: "Sabit Kanat",
    role: "Uluslararası İHA Yarışması",
    desc: "Eski akademik danışmanımız Öğr. Gör. Dr. Emre Özbek'in tasarladığı DORJE, Uluslararası İHA Yarışması sabit kanat kategorisinde yarıştı.",
    year: "—",
    specs: [
      { label: "Konfigürasyon", value: "Sabit Kanat" },
      { label: "Kategori", value: "Uluslararası İHA" },
    ],
  },
  {
    name: "HYDRA",
    slug: "hydra",
    sprite: { top: 561, left: 135, width: 403, height: 218 },
    codename: "2022 – 2028",
    role: "Ar-Ge · Hidrojen İtki",
    desc: "Sıfır emisyonlu ve uzun menzilli uçuş hedefiyle geliştirilen, gelişmiş PEM yakıt hücresi teknolojisiyle çalışan İHA projesi. Hidrojen itki sistemini takıma özgü aviyonikle birleştirir.",
    year: "2022–2028",
    specs: [
      { label: "İtki", value: "PEM Yakıt Hücresi" },
      { label: "Emisyon", value: "Sıfır" },
      { label: "Hedef", value: "Uzun Menzil" },
      { label: "Durum", value: "Geliştirme" },
    ],
  },
];

/** HARPY (2018) sprite kutusu — arşivde, gerekirse kullanılabilir */
export const HARPY_SPRITE = { top: 16, left: 169, width: 335, height: 206 };

/** Arşiv — geçmiş yıllarda üretilen platformlar */
export const FLEET_ARCHIVE = [
  { name: "BUMBLEBEE", year: "2015" },
  { name: "ATLAS", year: "2016" },
  { name: "TARDİS", year: "2016" },
  { name: "BALERİN", year: "2018" },
  { name: "SMARTQUAD", year: "2018" },
  { name: "TULPAR", year: "2018" },
  { name: "HARPY", year: "2018" },
  { name: "FOTON", year: "2019" },
];

/* ---------- SÜREÇ ---------- */
export const PROCESS_STEPS = [
  {
    n: "01",
    t: "Tasarım",
    d: "Görev gereksinimlerinden başlayıp aerodinamik ve yapısal tasarımı CAD ortamında kuruyoruz. Her parça uçmadan önce simüle edilir.",
  },
  {
    n: "02",
    t: "Üretim",
    d: "Kompozit kalıplama, CNC ve 3D baskı ile parçaları üretiyoruz. Karbon fiber gövde: hafif ve dayanıklı.",
  },
  {
    n: "03",
    t: "Entegrasyon",
    d: "Aviyonik, güç sistemleri ve otonom yazılımı gövdeye entegre ediyoruz. Yer testleri ve simülasyon doğrulaması burada yapılır.",
  },
  {
    n: "04",
    t: "Uçuş & Analiz",
    d: "Sahada test uçuşları, telemetri kaydı ve analiz. Her uçuş, bir sonraki tasarımı besleyen veri üretir.",
  },
];

/* ============================================================
   SPONSORLUK — sponsorluk dosyasındaki gerçek yapı
   First Class / Business Class / Economy Class
   ============================================================ */

export interface SponsorTier {
  key: "first" | "business" | "economy";
  name: string;
  label: string;
  threshold: string;
  featured?: boolean;
  /** Karşılaştırma tablosu satırları */
  matrix: {
    logoUcak: string;
    sosyalMedya: string;
    uretimGunlugu: string;
    basiliMateryal: string;
    logoKiyafet: string;
    urunTest: string;
  };
  perks: string[];
}

export const SPONSOR_TIERS: SponsorTier[] = [
  {
    key: "first",
    name: "First Class",
    label: "Ana Sponsor",
    threshold: "₺200.000+",
    featured: true,
    matrix: {
      logoUcak: "En büyük — ~20×20 cm",
      sosyalMedya:
        "Sabitlenen gönderi, firmaya özel video ve diğer seviyelerdeki tüm özellikler",
      uretimGunlugu: "Firmaya özel YouTube bölümü ve diğer özellikler",
      basiliMateryal: "En büyük",
      logoKiyafet: "Sırtta en büyük — ~15×15 cm",
      urunTest:
        "−10°C / +45°C aralığında 15+ sorti dayanıklılık raporu ve test analizlerinin paylaşımı",
    },
    perks: [
      "Uçakta büyük logo yerleşimi",
      "Ekip tişörtünün arka üstünde büyük logo",
      "Yarışma ve sergi roll-up'larında büyük logo",
      "Ekip üyeleriyle öncelikli görüşme hakkı",
      "Firmanız adına bilgilendirme semineri düzenleme hakkı",
      "Sosyal medyada logo ve firma tanıtımı (ayda en az bir paylaşım)",
      "İsteğe özel sosyal medya paylaşımları",
      "Özgeçmiş dosyası erişimi (tüm ekip üyelerinin CV'leri)",
      "Ekipten kişiselleştirilmiş teşekkür mektubu",
    ],
  },
  {
    key: "business",
    name: "Business Class",
    label: "Çözüm Ortağı",
    threshold: "₺100.000+",
    matrix: {
      logoUcak: "Orta — ~10×15 cm",
      sosyalMedya:
        "Çözüm ortağı gönderisi, marka paylaşımları (ayda bir), Economy Class özellikleri",
      uretimGunlugu: "Videolarda marka bahsi",
      basiliMateryal: "Orta",
      logoKiyafet: "Orta boy — ~10×10 cm",
      urunTest: "−10°C / +45°C aralığında 3 sorti test raporu",
    },
    perks: [
      "Uçakta orta boy logo yerleşimi",
      "Ekip tişörtünün arkasında orta boy logo",
      "Yarışma ve sergi roll-up'larında orta boy logo",
      "Firmanız adına bilgilendirme semineri düzenleme hakkı",
      "Firmanızı tanıtan sosyal medya paylaşımları (iki ayda en az bir)",
      "Özgeçmiş dosyası erişimi",
      "Ekipten kişiselleştirilmiş teşekkür mektubu",
    ],
  },
  {
    key: "economy",
    name: "Economy Class",
    label: "Destekçi",
    threshold: "₺20.000+",
    matrix: {
      logoUcak: "Küçük — ~7,5×10 cm",
      sosyalMedya: "Destek paylaşımları, videolarda ürün yerleştirme",
      uretimGunlugu: "Videolarda ürün yerleştirme",
      basiliMateryal: "Liste olarak",
      logoKiyafet: "Küçük — ~5×7,5 cm",
      urunTest: "—",
    },
    perks: [
      "Uçakta küçük logo yerleşimi",
      "Ekip tişörtünün arkasında küçük logo",
      "Yarışma ve sergi roll-up'larında küçük logo",
      "Sosyal medyada logo ve firma tanıtımı (üç ayda en az bir paylaşım)",
      "Ekipten kişiselleştirilmiş teşekkür mektubu",
    ],
  },
];

/** Karşılaştırma tablosu satır başlıkları */
export const SPONSOR_MATRIX_ROWS: {
  key: keyof SponsorTier["matrix"];
  label: string;
}[] = [
  { key: "logoUcak", label: "İHA gövdesi üzerinde logo" },
  { key: "logoKiyafet", label: "Takım kıyafetlerinde logo" },
  { key: "sosyalMedya", label: "Sosyal medya paylaşımları" },
  { key: "uretimGunlugu", label: '"Üretim Günlüğü" video sponsorluğu' },
  { key: "basiliMateryal", label: "Basılı materyaller (afiş, roll-up)" },
  { key: "urunTest", label: "Ürün test ve raporlama" },
];

export const SPONSOR_NOTE =
  "Sponsorluk paketlerimiz sadece nakit destekle sınırlı değildir. Takımımızın " +
  "ihtiyaç duyduğu teknik ekipman, ham madde veya hizmetlerin karşılanması " +
  "durumunda, sağlanan desteğin piyasa değeri üzerinden ilgili sponsorluk " +
  "kategorisindeki tüm haklar tanımlanır.";

/** Neden katkı yapmalısınız — sponsorluk dosyası s.10 */
export const SPONSOR_REASONS = [
  {
    t: "Marka Görünürlüğü ve İtibar",
    d: "Logonuz uçaklarımızda, takım kıyafetlerimizde, sosyal medya içeriklerimizde ve yarışma sunumlarımızda yer alır. TEKNOFEST gibi milyonlarca kişiye ulaşan etkinliklerde markanız öne çıkar.",
  },
  {
    t: "Nitelikli Yetenek Havuzuna Erişim",
    d: "Ekip üyelerimizin tamamı İHA teknolojisi ve mühendislik alanında pratik deneyime sahiptir. Staj, part-time çalışma veya kariyer fırsatları için ideal bir insan kaynakları havuzuyuz.",
  },
  {
    t: "Ürün Test ve Ar-Ge İş Birliği",
    d: "Ürünlerinizi (yapıştırıcılar, elektronik komponentler, sensörler) ekstrem uçuş koşullarında — yüksek hız, titreşim, farklı irtifalar — test eder, performans verilerini analiz eder ve teknik geri bildirim sunarız.",
  },
  {
    t: "Kurumsal Sosyal Sorumluluk",
    d: "Türkiye'nin geleceğine yatırım yaparken genç mühendislerin kariyerlerine doğrudan katkıda bulunur, sürdürülebilir bir eğitim ekosisteminin parçası olursunuz.",
  },
  {
    t: "Özel Sponsorluk Portfolyosu",
    d: "Yıl boyunca gerçekleştirdiğimiz tüm başarılar, etkinlikler ve medya çıkışlarında markanızın katkısını vurgulayan özel raporlama. Sosyal sorumluluk raporlarınız için somut içerik ve metrikler.",
  },
];

/** Güncel sponsorlarımız — logolar public/images/sponsors/<ad>.png altına konur */
export interface Sponsor2025 {
  name: string;
  role: string;
  logo: string | null;
}

export const SPONSORS_2025: Sponsor2025[] = [
  { name: "ETİ", role: "Ana Sponsor", logo: "/images/sponsors/eti.png" },
  { name: "T-Motor", role: "Ürün Sponsoru", logo: null },
  { name: "Özzaim", role: "Destekçi", logo: null },
  { name: "Dekor", role: "Destekçi", logo: null },
  { name: "Selsil", role: "Destekçi", logo: null },
  { name: "Gökhan İHA", role: "Destekçi", logo: null },
];
