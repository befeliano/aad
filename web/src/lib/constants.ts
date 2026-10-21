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
  memberCount: "40+",
  alumniCount: "250+",
  branchCount: "10+",
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
  advisor: "Danışman Hoca",
  mentor: "Danışman",
  sistem: "Teknik Yönetici",
  captain: "Birim Kaptanı",
  member: "Üye",
};

/**
 * Tam yetkili roller — DB'deki is_admin() ile birebir aynı küme olmalı
 * (supabase/roller-danisman.sql). Takım kaptanı, yardımcısı, danışman
 * hocalar, danışmanlar ve kişiye ait olmayan teknik yönetici hesabı.
 *
 * DİKKAT: "captain" (birim kaptanı) BURAYA GİRMEZ. Birim kaptanı olmak
 * finans gibi kritik verilere erişim vermez; yetkileri düz üye ile aynıdır,
 * "Birim Kaptanı" yalnızca unvandır.
 */
export const LEADERSHIP_ROLES = [
  "admin",
  "vice",
  "advisor",
  "mentor",
  "sistem",
] as const;

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
  uye: "40+",
  mezun: "250+",
  birincilik: "3",
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
    desc: "Otonom görev yazılımını, görüntü işleme algoritmalarını ve yer istasyonu arayüzünü yazar.",
    detail:
      "Hava aracının hedef takip, kilitlenme ve kamikaze gibi otonom görevlerinin icra edilmesinden; görüntü işleme algoritmaları ile yer istasyonu arayüzünün geliştirilmesinden sorumludur.",
  },
  {
    key: "tasarim",
    num: "02",
    name: "Tasarım",
    short: "Design",
    desc: "Uçağın aerodinamik tasarımını, 3B modelini ve performans analizlerini yapar.",
    detail:
      "Hava aracının aerodinamik tasarımını, 3B modellemesini ve performans analizlerini yürütür. İmalat ve montaj fazları için gerekli teknik resimleri, üretim şablonlarını ve yardımcı aparatları tasarlayarak ilgili teknik kılavuzları hazırlar.",
  },
  {
    key: "kompozit",
    num: "03",
    name: "Kompozit",
    short: "Composites",
    desc: "Kritik yapısal parçaları kompozitten üretir, malzeme üzerine Ar-Ge yapar.",
    detail:
      "Tasarlanan hava aracının gövde, kanat ve iniş takımı gibi bazı kritik yapısal parçalarının karbon fiber, cam elyaf ve epoksi gibi malzemeler kullanılarak üretilmesinden ve bu kapsamda Ar-Ge çalışmaları ile hava aracına hafiflik ve dayanım kazandırılmasından sorumludur.",
  },
  {
    key: "aviyonik",
    num: "04",
    name: "Aviyonik",
    short: "Avionics",
    desc: "Uçağın elektroniğini, haberleşmesini ve otonom kontrol sistemlerini kurar.",
    detail:
      "Hava aracının elektronik, haberleşme ve otonom kontrol sistemlerinden sorumludur. Bu sorumluluklar kapsamında otonom uçuş ve görev mekanizmaları için gerekli donanımların entegrasyonu, enerji ve güç dağıtım sistemlerinin yapılandırılması, uçuş kontrol parametrelerinin optimizasyonu, hava aracı ile yer istasyonu arasındaki veri bağının (telemetri) sağlanması ve sistemler arası tüm kablaj altyapısının havacılık standartlarına uygun olarak tesis edilmesi yer alır.",
  },
  {
    key: "yapisal",
    num: "05",
    name: "Yapısal",
    short: "Structures",
    desc: "Uçağın üretimini, montajını ve mekanik entegrasyonunu yapar.",
    detail:
      "Tasarlanan insansız hava araçlarının fiziksel üretim, montaj ve mekanik entegrasyon süreçlerinden sorumludur. Kanat, gövde ve kuyruk gibi ana yapıların üretimi ve montajı ile gerekli mekanik sistemlerin entegrasyonu gerçekleştirilir. Ayrıca uçuş öncesi yapısal kontroller ve dayanıklılık testleri yapılarak hava aracının güvenli ve uçuşa hazır olması sağlanır.",
  },
  {
    key: "medya",
    num: "06",
    name: "Sosyal Medya ve Sponsorluk",
    short: "Social Media & Sponsorship",
    desc: "Sosyal medyayı, takımın kurumsal kimliğini ve sponsor ilişkilerini yürütür.",
    detail:
      "Takımın dijital platformlardaki görünürlüğünü artırmak, kurumsal kimliğini güçlendirmek ve sponsorluk süreçlerini yürütmekten sorumludur. Sosyal medya içeriklerinin hazırlanması, tanıtım ve iletişim stratejilerinin geliştirilmesi, potansiyel sponsorlarla iletişime geçilmesi, sponsorluk anlaşmalarının yürütülmesi ve mevcut iş birliklerinin sürdürülebilirliğinin sağlanmasını kapsar.",
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

type AircraftSpecKey =
  | "year"
  | "fuselage"
  | "wing"
  | "tail"
  | "wingPosition"
  | "tailConfiguration"
  | "landingGear"
  | "motorPosition"
  | "takeoffWeight";

const AIRCRAFT_SPEC_FIELDS: { key: AircraftSpecKey; label: string }[] = [
  { key: "year", label: "Yıl" },
  { key: "fuselage", label: "Gövde" },
  { key: "wing", label: "Kanat" },
  { key: "tail", label: "Kuyruk" },
  { key: "wingPosition", label: "Kanat Konumu" },
  { key: "tailConfiguration", label: "Kuyruk Yapısı" },
  { key: "landingGear", label: "İniş Takımı" },
  { key: "motorPosition", label: "Motor Konumu" },
  { key: "takeoffWeight", label: "Kalkış Ağırlığı" },
];

function aircraftSpecs(
  values: Partial<Record<AircraftSpecKey, string>> = {}
): { label: string; value: string }[] {
  return AIRCRAFT_SPEC_FIELDS.map(({ key, label }) => ({
    label,
    value: values[key] ?? "",
  }));
}

export const FLEET: Aircraft[] = [
  {
    name: "DABAN",
    slug: "daban",
    codename: "Geliştirme",
    role: "Planlanan Hava Aracı",
    desc: "Tamamen kompozitten üreteceğimiz yeni uçağımız. Şu an tasarım aşamasında.",
    year: "Geliştirme",
    specs: aircraftSpecs({
      year: "Geliştirme",
      fuselage: "Kompozit",
      wing: "Kompozit",
      tail: "Kompozit",
      tailConfiguration: "Standart",
      landingGear: "Var",
      motorPosition: "Önden Çift Motor",
    }),
  },
  {
    name: "GÖLGE MK5",
    slug: "golge",
    sprite: { top: 264, left: 100, width: 403, height: 219 },
    codename: "2026",
    role: "Savaşan İHA",
    desc: "Savaşan İHA yarışması için geliştirdiğimiz ters V kuyruklu uçak. Hem hava-hava hem hava-kara görevlerinde uçacak; çalışmalar sürüyor.",
    year: "2026",
    specs: aircraftSpecs({
      year: "2026",
      fuselage: "Kompozit",
      tailConfiguration: "Ters V Kuyruk",
      landingGear: "Var",
      motorPosition: "Arkadan",
    }),
    features: [
      {
        t: "Amaç",
        d: "Yangın tespiti",
      },
      {
        t: "Sonuç",
        d: "Savaşan İHA yarışma hava aracı",
      },
      {
        t: "Görev Profilleri",
        d: "Hava-hava ve hava-kara görevleri",
      },
      {
        t: "Otonomi",
        d: "Görevin tamamını otonom uçması hedefleniyor.",
      },
    ],
  },
  {
    name: "MERLIN",
    slug: "merlin",
    codename: "2025",
    role: "TÜBİTAK Uluslararası İHA Yarışması",
    desc: "TÜBİTAK Uluslararası İHA Yarışması için yaptığımız, kendi ağırlığının 2,5 katı yük taşıyabilen uçak. Parçalarına ayrılıp küçük bir kutuya sığıyor; kutudan çıkarıp uçuşa hazırlamak 1 dakika 46 saniye sürüyor.",
    year: "2025",
    specs: aircraftSpecs({
      year: "2025",
      tailConfiguration: "Standart",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
    features: [
      {
        t: "Modüler Tasarım",
        d: "Parçalarına ayrılıp küçük bir taşıma kutusuna sığıyor.",
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
    codename: "",
    role: "SAE Aero Design",
    desc: "2017 SAE Aero Design East'te uçurduğumuz, parçalarına ayrılabilen yük uçağı.",
    year: "",
    specs: aircraftSpecs({
      tailConfiguration: "Standart",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
    features: [
      {
        t: "Amaç",
        d: "Yüksek yük taşıma oranı",
      },
      {
        t: "Sonuç",
        d: "Yüksek yük taşıma kabiliyeti",
      },
      {
        t: "Biyomimetik Tasarım",
        d: "Tasarımında doğadaki yapılardan ve canlıların hareketinden ilham aldık.",
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
    desc: "TÜBİTAK Uluslararası İHA Yarışması'nın sabit kanat kategorisinde yarışan uçağımız.",
    year: "2025",
    specs: aircraftSpecs({
      year: "2025",
      tailConfiguration: "Standart",
      landingGear: "Var",
      motorPosition: "Önden",
    }),
    features: [
      {
        t: "Sabit Kanat Kategorisi",
        d: "TÜBİTAK Uluslararası İHA Yarışması için tasarlandı.",
      },
    ],
  },
  {
    name: "HYDRA MK3",
    slug: "hydra",
    sprite: { top: 561, left: 135, width: 403, height: 218 },
    codename: "2020",
    role: "Ar-Ge · Hidrojen İtki",
    desc: "Hidrojen yakıt hücresiyle uçan Ar-Ge uçağımız. Amacı, hiç emisyon üretmeden uzun mesafe uçmak.",
    year: "2020",
    specs: aircraftSpecs({
      year: "2020",
      fuselage: "Kompozit",
      wing: "EPS Köpük",
      tail: "Huş + Balsa Kaplama",
      wingPosition: "Üstten",
      tailConfiguration: "T Kuyruk",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
    features: [
      {
        t: "Hidrojen Yakıt Sistemi",
        d: "Enerjisini hidrojen yakıt hücresinden alıyor; hedef sıfır emisyonla uzun menzil.",
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
    specs: aircraftSpecs({
      year: "2015",
      tailConfiguration: "Standart",
      landingGear: "Var",
      motorPosition: "Önden",
    }),
  },
  {
    name: "ATLAS",
    slug: "atlas",
    codename: "2016",
    role: "",
    desc: "",
    year: "2016",
    specs: aircraftSpecs({
      year: "2016",
      tailConfiguration: "Standart",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
  },
  {
    name: "TARDİS",
    slug: "tardis",
    codename: "2016",
    role: "",
    desc: "",
    year: "2016",
    specs: aircraftSpecs({
      year: "2016",
      tailConfiguration: "Pi-Tail",
      landingGear: "Var",
      motorPosition: "Arkadan",
    }),
  },
  {
    name: "BALERİN",
    slug: "balerin",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: aircraftSpecs({
      year: "2018",
      tailConfiguration: "Standart",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
  },
  {
    name: "SMARTQUAD",
    slug: "smartquad",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: aircraftSpecs({ year: "2018" }),
  },
  {
    name: "TULPAR",
    slug: "tulpar",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: aircraftSpecs({
      year: "2018",
      tailConfiguration: "Ters U Kuyruk (Pi Kuyruk)",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
  },
  {
    name: "HARPY",
    slug: "harpy",
    codename: "2018",
    role: "",
    desc: "",
    year: "2018",
    specs: aircraftSpecs({
      year: "2018",
      tailConfiguration: "Standart",
      landingGear: "Var",
      motorPosition: "Önden",
    }),
  },
  {
    name: "FOTON",
    slug: "foton",
    codename: "2019",
    role: "",
    desc: "",
    year: "2019",
    specs: aircraftSpecs({
      year: "2019",
      tailConfiguration: "Standart",
      landingGear: "Yok",
      motorPosition: "Önden",
    }),
  },
];

/** HARPY (2018) sprite kutusu — arşivde, gerekirse kullanılabilir */
export const HARPY_SPRITE = { top: 16, left: 169, width: 335, height: 206 };

/* ---------- SÜREÇ ---------- */
export const PROCESS_STEPS = [
  {
    n: "01",
    t: "Tasarım",
    d: "Görevin gereksinimlerinden yola çıkıp aerodinamik ve yapısal tasarımı CAD'de yapıyoruz. Parçaları uçmadan önce simülasyonda deniyoruz.",
  },
  {
    n: "02",
    t: "Üretim",
    d: "Parçaları kompozit kalıplama, CNC ve 3D baskıyla üretiyoruz. Gövdede hafif ve sağlam olduğu için karbon fiber kullanıyoruz.",
  },
  {
    n: "03",
    t: "Entegrasyon",
    d: "Aviyoniği, güç sistemini ve otonom yazılımı gövdeye yerleştiriyoruz. Uçmadan önce yer testleri ve simülasyonla kontrol ediyoruz.",
  },
  {
    n: "04",
    t: "Uçuş & Analiz",
    d: "Sahada test uçuşu yapıp telemetri kayıtlarını inceliyoruz. Çıkan sonuçlar bir sonraki tasarıma yön veriyor.",
  },
];

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
    d: "Desteğiniz, öğrencilerin okulda göremeyecekleri uygulamalı mühendislik deneyimini kazanmasına doğrudan katkı sağlar.",
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
  /**
   * Sponsorluk sayfasındaki kademe: 1 en üstte ve en büyük.
   * Aynı kademe içindeki sıra = bu dizideki sıra. Sıralamayı Medya &
   * Sponsorluk birimi belirler; yalnızca bu alanı ve sırayı değiştirmek yeter.
   */
  tier: 1 | 2 | 3;
}

/**
 * Takıma katılım başvuru formu (Google Forms).
 * Form değişirse yalnızca bu satırı güncelleyin — /katil sayfası
 * gömülü sürümü buradan türetiyor.
 */
export const BASVURU_FORMU =
  "https://docs.google.com/forms/d/e/1FAIpQLSeoVJqII8kcXFiZfvzz4WbdpafNmuuIHxrzHpfxDQxkpkGGKw/viewform";

export const SPONSORS_2025: Sponsor2025[] = [
  { name: "ETİ", role: "Ana Sponsor", logo: "/images/sponsors/eti.png", tier: 1 },
  { name: "T-Motor", role: "Ürün Sponsoru", logo: "/images/sponsors/t-motor.png", tier: 2 },
  { name: "Zaxe", role: "Ürün Sponsoru", logo: "/images/sponsors/zaxe.png", tier: 2 },
  { name: "TESA", role: "Destekçi", logo: "/images/sponsors/tesa.jpg", tier: 3 },
  { name: "Özzaim", role: "Destekçi", logo: "/images/sponsors/ozzaim.jpg", tier: 3 },
  { name: "Dekor", role: "Destekçi", logo: "/images/sponsors/dekor.webp", tier: 3 },
  { name: "Selsil", role: "Destekçi", logo: "/images/sponsors/selsil.png", tier: 3 },
  { name: "Gökhan İHA", role: "Destekçi", logo: "/images/sponsors/gokhan-iha.png", tier: 3 },
];
