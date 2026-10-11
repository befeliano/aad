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
  alumniCount: "250+",
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
    name: "Emin Sakallıoğlu",
    role: "Takım Kaptanı",
  },
  {
    name: "Yekta Özüer",
    role: "Takım Kaptan Yardımcısı",
  },
];

// TODO: Takım yönetimi e-posta adresleri daha sonra eklenecek.
/** Akademik danışmanlar */
export const ADVISORS = [
  { name: "Dr. Öğr. Üy. Emre ÖZBEK", role: "Danışman" },
  { name: "Araş. Gör. Mustafa AZER", role: "Danışman" },
  { name: "Öğr. Gör. Dr. İbrahim Yavuz DAL", role: "Danışman Pilot" },
];

/** 2026 hedef yarışma */
export const COMPETITION_2026 = {
  name: "TEKNOFEST TÜBİTAK Uluslararası İHA Yarışması",
  subtitle: "Savaşan İHA Kategorisi",
  location: "Şanlıurfa",
  date: "Ağustos – Eylül 2026",
  highlights: [
    {
      t: "Tam Otonom Uçuş",
      d: "İHA'lar kalkıştan inişe kadar tüm uçuş manevralarını hiçbir manuel müdahale olmadan kendi yazılımlarıyla gerçekleştirir.",
    },
    {
      t: "Hava Muharebesi ve Hedef Takibi",
      d: "Rakip hava araçları otonom olarak tespit edilir ve hedef takip verileri anlık olarak yarışma sunucusuna gönderilir.",
    },
    {
      t: "Görev Başarısı ve Puanlama",
      d: "Bir hafta süren final maratonunda görevleri tamamlayıp en yüksek puanı toplayan takım birincilik elde eder.",
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
/* ---------- BAŞARILAR ---------- */
export interface Achievement {
  year: string;
  title: readonly [string, string];
  detail: readonly [string, string];
  rank: string;
  highlight?: boolean;
  scope: "ulusal" | "uluslararasi";
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    year: "2022",
    title: ["TEKNOFEST Savaşan İHA", "TEKNOFEST Fighter UAV"],
    detail: ["1.'lik", "1st Place"],
    rank: "1",
    scope: "uluslararasi",
  },
  {
    year: "2018",
    title: [
      "TEKNOFEST TÜBİTAK Uluslararası İHA",
      "TEKNOFEST TÜBİTAK International UAV",
    ],
    detail: ["1.'lik", "1st Place"],
    rank: "1",
    scope: "uluslararasi",
  },
  {
    year: "2017",
    title: ["SAE Aero Design East", "SAE Aero Design East"],
    detail: ["1.'lik", "1st Place"],
    rank: "1",
    scope: "uluslararasi",
  },
  {
    year: "2026",
    title: ["TEKNOFEST Savaşan İHA", "TEKNOFEST Fighter UAV"],
    detail: ["Finalistlik", "Finalist"],
    rank: "99",
    scope: "uluslararasi",
  },
  {
    year: "2026",
    title: ["Anduril AI Grand Prix", "Anduril AI Grand Prix"],
    detail: ["14.'lük", "14th Place"],
    rank: "14",
    scope: "uluslararasi",
  },
  {
    year: "2025",
    title: ["TEKNOFEST Savaşan İHA", "TEKNOFEST Fighter UAV"],
    detail: ["Finalistlik", "Finalist"],
    rank: "99",
    scope: "uluslararasi",
  },
  {
    year: "2025",
    title: [
      "TEKNOFEST TÜBİTAK Uluslararası İHA",
      "TEKNOFEST TÜBİTAK International UAV",
    ],
    detail: ["Finalistlik", "Finalist"],
    rank: "99",
    scope: "uluslararasi",
  },
  {
    year: "2024",
    title: ["TEKNOFEST Savaşan İHA", "TEKNOFEST Fighter UAV"],
    detail: ["7.'lik", "7th Place"],
    rank: "7",
    scope: "uluslararasi",
  },
  {
    year: "2022",
    title: [
      "TEKNOFEST Karma Sürü Simülasyon",
      "TEKNOFEST Mixed Swarm Simulation",
    ],
    detail: ["3.'lük", "3rd Place"],
    rank: "3",
    scope: "uluslararasi",
  },
  {
    year: "2021",
    title: ["TEKNOFEST Savaşan İHA", "TEKNOFEST Fighter UAV"],
    detail: ["5.'lik", "5th Place"],
    rank: "5",
    scope: "uluslararasi",
  },
  {
    year: "2020",
    title: ["TEKNOFEST Sürü İHA", "TEKNOFEST Swarm UAV"],
    detail: ["2.'lik", "2nd Place"],
    rank: "2",
    scope: "uluslararasi",
  },
  {
    year: "2019",
    title: [
      "TEKNOFEST TÜBİTAK Uluslararası İHA",
      "TEKNOFEST TÜBİTAK International UAV",
    ],
    detail: ["5.'lik", "5th Place"],
    rank: "5",
    scope: "uluslararasi",
  },
  {
    year: "2016",
    title: ["SAE Aero Design", "SAE Aero Design"],
    detail: ["Genel sıralamada 3.'lük", "3rd Place Overall"],
    rank: "3",
    scope: "uluslararasi",
  },
  {
    year: "2015",
    title: ["Future Flight Design", "Future Flight Design"],
    detail: ["Genel sıralamada 2.'lik", "2nd Place Overall"],
    rank: "2",
    scope: "uluslararasi",
  },
  {
    year: "2014",
    title: ["SAE Aero Design", "SAE Aero Design"],
    detail: ["Genel sıralamada 6.'lık", "6th Place Overall"],
    rank: "6",
    scope: "uluslararasi",
  },
  {
    year: "2013",
    title: ["SAE Aero Design", "SAE Aero Design"],
    detail: ["11.'lik", "11th Place"],
    rank: "11",
    scope: "uluslararasi",
  },
];

export const TAKIM_ISTATISTIK = {
  kurulus: "2011",
  uye: "40",
  mezun: "250+",
  birincilik: "1",
  derece: "7",
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
    desc: "Hava araçlarının tasarımı ve bileşen tasarımları.",
    detail:
      "Hava araçlarının genel tasarımı ve bileşen tasarımları üzerinde çalışmalar yürütülür. Aerodinamik form, CAD modelleme ve simülasyon doğrulaması bu ekibin sorumluluğundadır.",
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
    desc: "Bileşen üretimi, onarımı ve montajı.",
    detail:
      "Bileşen üretimi, onarımı ve montajı gerçekleştirilir. Montaj süreçleri ve saha bakımı bu ekibin sorumluluğundadır.",
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
  specs?: { label: string; value: string }[];
  features?: { t: string; d: string }[];
  /** harpy-golge-hydra.svg içindeki kırpma kutusu (596×843 koordinat alanı) */
  sprite?: { top: number; left: number; width: number; height: number };
}

/** Üç uçağın tek dosyada durduğu vektör sayfa */
export const FLEET_SPRITE = {
  src: "/harpy-golge-hydra.svg",
  viewW: 596,
  viewH: 843,
};

const EMPTY_AIRCRAFT_SPECS = [
  { label: "Gövde", value: "" },
  { label: "Kanat", value: "" },
  { label: "Kuyruk", value: "" },
  { label: "Kanat Konumu", value: "" },
  { label: "Kuyruk Yapısı", value: "" },
  { label: "İniş Takımı", value: "" },
  { label: "Motor Konumu", value: "" },
];

export const FLEET: Aircraft[] = [
  {
    name: "DABAN",
    slug: "daban",
    codename: "Geliştirme",
    role: "Planlanan Hava Aracı",
    desc: "DABAN, üretilmesi planlanan tam kompozit hava aracımızdır. Tasarım çalışmaları sürmektedir.",
    year: "Planlama",
    specs: [
      { label: "Gövde", value: "Tam kompozit" },
      { label: "Kanat", value: "" },
      { label: "Kuyruk", value: "" },
      { label: "Kanat Konumu", value: "" },
      { label: "Kuyruk Yapısı", value: "" },
      { label: "İniş Takımı", value: "" },
      { label: "Motor Konumu", value: "" },
    ],
    features: [
      {
        t: "Kanat Açıklığı",
        d: "2,6 m olarak planlanmaktadır.",
      },
      {
        t: "Kalkış Ağırlığı",
        d: "8 kg olarak planlanmaktadır.",
      },
      {
        t: "Uzunluk",
        d: "1,85 m olarak planlanmaktadır.",
      },
      {
        t: "Motor",
        d: "2× T-Motor AT3520",
      },
      {
        t: "Kamera",
        d: "Hikrobot MV CS050",
      },
      {
        t: "Uçuş Kontrol Sistemi",
        d: "CUAV V6X",
      },
    ],
  },
  {
    name: "GÖLGE MK5",
    slug: "golge",
    sprite: { top: 264, left: 100, width: 403, height: 219 },
    codename: "2026",
    role: "Savaşan İHA",
    desc: "GÖLGE platformunun geliştirme çalışmaları devam etmektedir. Ters V-kuyruk mimarisiyle hava-hava ve hava-kara görevleri için geliştirilmektedir.",
    year: "2026",
    specs: [
      { label: "Gövde", value: "" },
      { label: "Kanat", value: "" },
      { label: "Kuyruk", value: "" },
      { label: "Kanat Konumu", value: "" },
      { label: "Kuyruk Yapısı", value: "Ters V" },
      { label: "İniş Takımı", value: "" },
      { label: "Motor Konumu", value: "" },
    ],
    features: [
      {
        t: "Görev Profilleri",
        d: "Hava-hava ve hava-kara görevleri için geliştirilmektedir.",
      },
      {
        t: "Otonomi",
        d: "Tam otonom görev icrası hedeflenmektedir.",
      },
    ],
  },
  {
    name: "MERLIN",
    slug: "merlin",
    codename: "2025",
    role: "TÜBİTAK Uluslararası İHA Yarışması",
    desc: "TÜBİTAK Uluslararası İHA Yarışması kriterlerine göre tasarlanan Merlin, yüksek yük kapasitesini modüler mimariyle birleştirir. Kompakt taşıma kutusuna sığar ve 1 dakika 46 saniyede uçuşa hazır hale gelir.",
    year: "2025",
    specs: [
      { label: "Gövde", value: "" },
      { label: "Kanat", value: "" },
      { label: "Kuyruk", value: "" },
      { label: "Kanat Konumu", value: "" },
      { label: "Kuyruk Yapısı", value: "" },
      { label: "İniş Takımı", value: "" },
      { label: "Motor Konumu", value: "" },
    ],
    features: [
      {
        t: "Modüler Tasarım",
        d: "Kompakt taşıma kutusuna sığacak şekilde tasarlanmıştır.",
      },
      {
        t: "Kurulum Süresi",
        d: "1 dakika 46 saniye",
      },
      {
        t: "Görev",
        d: "Otonom yük bırakma",
      },
      {
        t: "Yük Oranı",
        d: "Kendi ağırlığının 2,5 katı",
      },
    ],
  },
  {
    name: "JAEGER",
    slug: "jaeger",
    codename: "2017",
    role: "SAE Aero Design",
    desc: "2017 SAE Aero Design East yarışmasında kullanılan modüler hava aracı.",
    year: "2017",
    specs: [
      { label: "Gövde", value: "" },
      { label: "Kanat", value: "" },
      { label: "Kuyruk", value: "" },
      { label: "Kanat Konumu", value: "" },
      { label: "Kuyruk Yapısı", value: "" },
      { label: "İniş Takımı", value: "" },
      { label: "Motor Konumu", value: "" },
    ],
    features: [
      {
        t: "Biyomimetik Tasarım",
        d: "Doğadaki yapılardan ve hareket biçimlerinden esinlenilmiştir.",
      },
      {
        t: "Gövde Ağırlığı",
        d: "305 g",
      },
      {
        t: "Faydalı Yük",
        d: "1.287 g",
      },
      {
        t: "Montaj Süresi",
        d: "55 saniye",
      },
    ],
  },
  {
    name: "DORJE MK3",
    slug: "dorje",
    codename: "2025",
    role: "TÜBİTAK Uluslararası İHA Yarışması",
    desc: "DORJE, TÜBİTAK Uluslararası İHA Yarışması'nın sabit kanat kategorisi için geliştirildi.",
    year: "2025",
    specs: [
      { label: "Gövde", value: "" },
      { label: "Kanat", value: "Sabit kanat" },
      { label: "Kuyruk", value: "" },
      { label: "Kanat Konumu", value: "" },
      { label: "Kuyruk Yapısı", value: "" },
      { label: "İniş Takımı", value: "" },
      { label: "Motor Konumu", value: "" },
    ],
    features: [
      {
        t: "Sabit Kanat Kategorisi",
        d: "TÜBİTAK Uluslararası İHA Yarışması'nın sabit kanat kategorisi için geliştirilmiştir.",
      },
    ],
  },
  {
    name: "HYDRA MK3",
    slug: "hydra",
    sprite: { top: 561, left: 135, width: 403, height: 218 },
    codename: "2020",
    role: "Ar-Ge · Hidrojen İtki",
    desc: "Hidrojen yakıt hücresiyle çalışan ve sıfır emisyonlu uzun menzilli uçuş hedefiyle geliştirilen hava aracı.",
    year: "2020",
    specs: [
      { label: "Gövde", value: "Kompozit" },
      { label: "Kanat", value: "EPS Köpük" },
      { label: "Kuyruk", value: "Huş + Balsa Kaplama" },
      { label: "Kanat Konumu", value: "Üstten" },
      { label: "Kuyruk Yapısı", value: "T Kuyruk" },
      { label: "İniş Takımı", value: "Yok" },
      { label: "Motor Konumu", value: "Önden" },
    ],
    features: [
      {
        t: "Hidrojen Yakıt Sistemi",
        d: "Hidrojen yakıt hücresiyle çalışan hava aracı, sıfır emisyonlu uçuş ve uzun menzil hedefiyle geliştirilmektedir.",
      },
    ],
  },
  {
    name: "BUMBLEBEE",
    slug: "bumblebee",
    codename: "2015",
    role: "",
    desc: "",
    year: "2015",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "ATLAS",
    slug: "atlas",
    codename: "2016",
    role: "",
    desc: "",
    year: "2016",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "TARDİS",
    slug: "tardis",
    codename: "2016",
    role: "",
    desc: "",
    year: "2016",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "BALERİN",
    slug: "balerin",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "SMARTQUAD",
    slug: "smartquad",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "TULPAR",
    slug: "tulpar",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "HARPY",
    slug: "harpy",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
  {
    name: "FOTON",
    slug: "foton",
    codename: "2019",
    role: "",
    desc: "",
    year: "2019",
    specs: EMPTY_AIRCRAFT_SPECS,
  },
];

/** HARPY (2018) sprite kutusu — arşivde, gerekirse kullanılabilir */
export const HARPY_SPRITE = { top: 16, left: 169, width: 335, height: 206 };

/* ---------- SÜREÇ ---------- */
export const PROCESS_STEPS = [
  {
    n: "01",
    t: "Tasarım",
    d: "Aerodinamik ve yapısal tasarım, görev gereksinimlerinden hareketle CAD ortamında oluşturulur. Her parça uçuş öncesinde simüle edilir.",
  },
  {
    n: "02",
    t: "Üretim",
    d: "Parçalar kompozit kalıplama, CNC ve 3D baskı yöntemleriyle üretilir. Karbon fiber gövde hafif ve dayanıklıdır.",
  },
  {
    n: "03",
    t: "Entegrasyon",
    d: "Aviyonik, güç sistemleri ve otonom yazılım gövdeye entegre edilir. Yer testleri ve simülasyon doğrulaması gerçekleştirilir.",
  },
  {
    n: "04",
    t: "Uçuş & Analiz",
    d: "Sahada test uçuşları gerçekleştirilir; telemetri kaydı alınır ve analiz edilir. Uçuş verileri sonraki tasarım çalışmalarında kullanılır.",
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
    d: "Takım üyeleri insansız hava aracı teknolojisi ve mühendislik alanlarında uygulamalı deneyim kazanır. Staj ve kariyer fırsatları için iletişim kurulabilir.",
  },
  {
    t: "Ürün Test ve Ar-Ge İş Birliği",
    d: "Ürünleriniz (yapıştırıcılar, elektronik bileşenler, sensörler) uçuş koşullarında test edilir; performans verileri analiz edilerek teknik geri bildirim sunulur.",
  },
  {
    t: "Kurumsal Sosyal Sorumluluk",
    d: "Sağlanan destek, genç mühendislerin kariyer gelişimine katkı sağlar ve sürdürülebilir bir eğitim ekosistemini destekler.",
  },
  {
    t: "Özel Sponsorluk Portfolyosu",
    d: "Yıl boyunca elde edilen başarıları, etkinlikleri ve medya görünürlüğünü kapsayan; markanızın katkısını vurgulayan özel raporlama hazırlanır. Sosyal sorumluluk raporları için içerik ve ölçümler sunulur.",
  },
];

/** Güncel sponsorlarımız — logolar public/images/sponsors/<ad>.png altına konur */
export interface Sponsor2025 {
  name: string;
  role: string;
  logo: string | null;
}

/**
 * Takıma katılım başvuru formu (Google Forms).
 * Form değişirse yalnızca bu satırı güncelleyin — /katil sayfası
 * gömülü sürümü buradan türetiyor.
 */
export const BASVURU_FORMU =
  "https://docs.google.com/forms/d/e/1FAIpQLSeoVJqII8kcXFiZfvzz4WbdpafNmuuIHxrzHpfxDQxkpkGGKw/viewform";

export const SPONSORS_2025: Sponsor2025[] = [
  { name: "ETİ", role: "Ana Sponsor", logo: "/images/sponsors/eti.png" },
  { name: "T-Motor", role: "Ürün Sponsoru", logo: "/images/sponsors/t-motor.png" },
  { name: "Zaxe", role: "Ürün Sponsoru", logo: "/images/sponsors/zaxe.png" },
  { name: "TESA", role: "Destekçi", logo: "/images/sponsors/tesa.jpg" },
  { name: "Özzaim", role: "Destekçi", logo: "/images/sponsors/ozzaim.jpg" },
  { name: "Dekor", role: "Destekçi", logo: "/images/sponsors/dekor.webp" },
  { name: "Selsil", role: "Destekçi", logo: "/images/sponsors/selsil.png" },
  { name: "Gökhan İHA", role: "Destekçi", logo: "/images/sponsors/gokhan-iha.png" },
];
