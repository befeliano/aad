/* ============================================================
   Paylaşılan sabitler — departmanlar, filo, başarılar
   ============================================================ */

export const TEAM = {
  name: "Anatolia Aero Design",
  fullName: "ESTÜ Anatolia Aero Design",
  tagline: "İHA Proje Takımı",
  university: "Eskişehir Teknik Üniversitesi",
  address: "İki Eylül Kampüsü, Tepebaşı / Eskişehir",
  email: "anatoliaaerodesign@gmail.com",
  instagram: "anatoliaaerodesign",
  instagramUrl: "https://instagram.com/anatoliaaerodesign",
  youtubeUrl: "https://youtube.com/@anatoliaaerodesign",
  tiktokUrl: "https://tiktok.com/@anatoliaaerodesign",
  linkedinUrl: "https://linkedin.com/company/anatolia-aero-design/",
  founded: "2015",
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

export type DeptKey =
  | "yazilim"
  | "yapisal"
  | "aviyonik"
  | "kompozit"
  | "sponsorluk"
  | "medya"
  | "ortak";

export const DEPT_LABELS: Record<string, string> = {
  yazilim: "Yazılım",
  yapisal: "Yapısal",
  aviyonik: "Aviyonik",
  kompozit: "Kompozit",
  sponsorluk: "Sponsorluk",
  medya: "Medya & Tanıtım",
  ortak: "Ortak",
};

export const DEPT_KEYS: DeptKey[] = [
  "yazilim",
  "yapisal",
  "aviyonik",
  "kompozit",
  "sponsorluk",
  "medya",
];

/* ---------- BAŞARILAR (Instagram profilinden doğrulandı) ---------- */
export interface Achievement {
  year: string;
  title: string;
  detail: string;
  rank: string;
  highlight?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    year: "2022",
    title: "Teknofest Savaşan İHA",
    detail: "Fighter UAV kategorisi — Türkiye birinciliği",
    rank: "1.",
    highlight: true,
  },
  {
    year: "2018",
    title: "Teknofest UAV Turkey",
    detail: "İnsansız hava aracı kategorisi — Türkiye birinciliği",
    rank: "1.",
    highlight: true,
  },
  {
    year: "2017",
    title: "International SAE Aero Design",
    detail: "Uluslararası tasarım yarışması — derece",
    rank: "🥇",
  },
  {
    year: "2016",
    title: "International SAE Aero Design",
    detail: "Uluslararası tasarım yarışması — derece",
    rank: "🥇",
  },
];

export const TAKIM_ISTATISTIK = {
  kurulus: "2015",
  departman: "6",
  birincilik: "2x",
  takipci: "4.5K+",
};

/* ---------- DEPARTMANLAR ---------- */
export interface Department {
  key: DeptKey;
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
    desc: "Otonom görev yazılımı, güdüm algoritmaları, yer kontrol istasyonu.",
    detail:
      "Görüntü işleme ile hedef tespiti, Pro Nav ve Path Chase güdüm algoritmaları, RK4 konum tahmini ve gerçek zamanlı yer kontrol istasyonu bu ekipten çıkar.",
  },
  {
    key: "yapisal",
    num: "02",
    name: "Yapısal",
    short: "Structures",
    desc: "Mekanik tasarım, montaj, dayanım analizi.",
    detail:
      "İHA gövdesinin mekanik tasarımı, sonlu elemanlar analizi ile dayanım doğrulaması ve tüm montaj süreçleri. Ağırlık ile mukavemet arasındaki dengeyi kuran ekip.",
  },
  {
    key: "aviyonik",
    num: "03",
    name: "Aviyonik",
    short: "Avionics",
    desc: "Sensör entegrasyonu, elektronik, telemetri hattı.",
    detail:
      "Uçuş kontrol kartları, sensör füzyonu, güç dağıtımı ve telemetri altyapısı. Uçağın sinir sistemini kuran ve verinin yere akmasını sağlayan ekip.",
  },
  {
    key: "kompozit",
    num: "04",
    name: "Kompozit",
    short: "Composites",
    desc: "Karbon fiber, kalıplama, yüzey işleme.",
    detail:
      "Karbon fiber ve cam elyaf ile hafif, dayanıklı gövde parçaları üretiyoruz. Kalıp tasarımı, vakum infüzyon ve yüzey işleme süreçleri burada yürütülür.",
  },
  {
    key: "sponsorluk",
    num: "05",
    name: "Sponsorluk",
    short: "Partnerships",
    desc: "Kurumsal ilişkiler, finansman, bütçe yönetimi.",
    detail:
      "Kurumsal sponsorlarla ilişkileri yürütür, bütçeyi departmanlara tahsis eder ve takımın sürdürülebilir finansmanını sağlar.",
  },
  {
    key: "medya",
    num: "06",
    name: "Medya & Tanıtım",
    short: "Media",
    desc: "İçerik, fotoğraf, video, sosyal medya.",
    detail:
      "Takımın hikâyesini anlatır: fotoğraf, video, sosyal medya ve sponsorlara sunulan tüm tanıtım materyalleri bu ekipten çıkar.",
  },
];

/* ---------- FİLO ---------- */
export interface Aircraft {
  name: string;
  /** public/images/fleet/<slug>.jpg dosyasıyla eşleşir */
  slug: string;
  codename: string;
  role: string;
  desc: string;
  specs: { label: string; value: string }[];
  flagship?: boolean;
}

export const FLEET: Aircraft[] = [
  {
    name: "GÖLGE",
    slug: "golge",
    codename: "AAD-01",
    role: "Savaşan İHA · Amiral Gemisi",
    desc: "Takımın en iyisi. Teknofest Savaşan İHA görev profili için sıfırdan tasarlanan, otonom hedef tespiti, kilitlenme ve kamikaze yeteneğine sahip sabit kanatlı savaş İHA'sı. Gövdesinden yazılımına kadar her parçası kendi ekiplerimiz tarafından üretildi.",
    flagship: true,
    specs: [
      { label: "Konfigürasyon", value: "Sabit Kanat" },
      { label: "Görev", value: "Savaşan İHA" },
      { label: "Güdüm", value: "Pro Nav" },
      { label: "Otonomi", value: "Tam Otonom" },
    ],
  },
  {
    name: "HYDRA",
    slug: "hydra",
    codename: "AAD-02",
    role: "Görev Platformu",
    desc: "Otonom görev ve hedef takibi platformu. Güdüm algoritmalarının uçuş doğrulaması burada yapılır.",
    specs: [
      { label: "Konfigürasyon", value: "Sabit Kanat" },
      { label: "Amaç", value: "Görev / Test" },
    ],
  },
  {
    name: "HARPY",
    slug: "harpy",
    codename: "AAD-03",
    role: "Aviyonik Ar-Ge",
    desc: "Aviyonik geliştirme ve veri toplama platformu. Sensör füzyonu ve yeni kartların denendiği araç.",
    specs: [
      { label: "Konfigürasyon", value: "Sabit Kanat" },
      { label: "Amaç", value: "Ar-Ge" },
    ],
  },
  {
    name: "KARTAL",
    slug: "kartal",
    codename: "AAD-04",
    role: "Eğitim & Test",
    desc: "Eğitim ve yapısal test platformu. Yeni üyelerin uçuş tecrübesi kazandığı güvenli zemin.",
    specs: [
      { label: "Konfigürasyon", value: "Sabit Kanat" },
      { label: "Amaç", value: "Eğitim" },
    ],
  },
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
   SPONSORLUK — gerçek işleyiş
   Paket satışı değil: görüşme → destek → faturalı harcama →
   şeffaf raporlama → marka görünürlüğü
   ============================================================ */

export interface SponsorStep {
  n: string;
  t: string;
  d: string;
}

export const SPONSOR_STEPS: SponsorStep[] = [
  {
    n: "01",
    t: "Tanışma & Sunum",
    d: "Takımı, projelerimizi ve yıllık hedeflerimizi anlatan bir sunumla size geliyoruz. Neyi, neden, ne kadar bütçeyle yapacağımızı açıkça paylaşıyoruz.",
  },
  {
    n: "02",
    t: "Destek",
    d: "Nakdi ya da ayni destek sağlıyorsunuz. Malzeme, üretim, seyahat ve yarışma masraflarının hangi kalemine gideceği baştan belli.",
  },
  {
    n: "03",
    t: "Faturalı Harcama",
    d: "Desteğin tamamı faturalı olarak harcanır. Her kalem belgelenir; hiçbir harcama kayıt dışı kalmaz.",
  },
  {
    n: "04",
    t: "Şeffaf Raporlama",
    d: "Harcama kalemlerini, ulaşılan sonuçları ve yarışma performansını içeren raporu size iletiyoruz. Paranın nereye gittiğini kalem kalem görüyorsunuz.",
  },
  {
    n: "05",
    t: "Marka Görünürlüğü",
    d: "Logonuz uçak gövdesinde, kanatta, takım tişörtlerinde, tanıtım içeriklerinde ve yarışma alanındaki standımızda yer alır.",
  },
];

export interface VisibilitySurface {
  title: string;
  desc: string;
}

/** Sponsor logosunun fiilen göründüğü yerler */
export const VISIBILITY_SURFACES: VisibilitySurface[] = [
  {
    title: "Uçak Gövdesi & Kanat",
    desc: "Logonuz yarışan İHA'nın gövdesinde ve kanadında. Uçuş görüntüleri, fotoğraflar ve yayınlarda doğrudan kadraja giriyor.",
  },
  {
    title: "Takım Tişörtü & Ekipman",
    desc: "Takım kıyafetlerimizde ve saha ekipmanlarımızda. Yarışma boyunca alanda dolaşan her üyede markanız var.",
  },
  {
    title: "Dijital Kanallar",
    desc: "Instagram, YouTube, TikTok ve LinkedIn içeriklerimizde; tanıtım videolarında ve web sitemizde.",
  },
  {
    title: "Yarışma Alanı & Etkinlikler",
    desc: "Teknofest standımızda, sunum materyallerinde ve üniversite etkinliklerinde kurumsal görünürlük.",
  },
];

/** Sponsora verdiğimiz taahhütler */
export const SPONSOR_COMMITMENTS = [
  "Desteğin tamamı faturalı harcanır",
  "Kalem kalem harcama raporu",
  "Yarışma sonrası performans raporu",
  "Logo kullanımında marka rehberinize uyum",
  "Talep hâlinde öğrenci ziyareti ve iş birliği",
];
