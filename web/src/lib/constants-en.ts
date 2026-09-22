/* ============================================================
   İngilizce içerik katmanı.

   constants.ts Türkçe kaynaktır ve tek doğruluk kaynağı olarak kalır.
   Burada yalnızca ÇEVİRİLER var; her giriş kaynaktaki kalıcı bir
   kimliğe (slug / key / ad) bağlı. Böylece Türkçe metin değişince
   İngilizcesi sessizce eskimiyor — eşleşme kimlik üzerinden kuruluyor.

   Kullanım: doğrudan içeri almayın, `@/lib/content` içindeki
   use* kancalarını çağırın.
   ============================================================ */

import type { Aircraft, Department, SponsorTier } from "./constants";

/* ---------- FİLO ---------- */

type FleetOverlay = Partial<
  Pick<Aircraft, "role" | "desc" | "codename" | "specs" | "features">
>;

/** slug → İngilizce künye */
export const FLEET_EN: Record<string, FleetOverlay> = {
  daban: {
    role: "Combat UAV · Flagship",
    desc: "Our 2027 Combat UAV platform. A twin-engine, fully autonomous combat UAV that folds years of competition experience into a more aggressive and more durable airframe. Its large internal volume carries advanced sensor fusion and on-board AI.",
    specs: [
      { label: "Wingspan", value: "2.6 m" },
      { label: "Take-off Weight", value: "8 kg" },
      { label: "Length", value: "1.85 m" },
      { label: "Endurance", value: "30 min" },
      { label: "Cruise Speed", value: "17 m/s" },
      { label: "Motor", value: "2× T-Motor AT3520" },
      { label: "Camera", value: "Hikrobot MV CS050" },
      { label: "Flight Controller", value: "CUAV V6X" },
    ],
    features: [
      {
        t: "Twin-Engine Configuration",
        d: "Instant manoeuvrability at high speed plus full system redundancy. Gives a decisive speed and climb advantage in a dogfight.",
      },
      {
        t: "Advanced Airframe, Large Volume",
        d: "Houses more complex avionics and high-performance compute units without giving up aerodynamic efficiency.",
      },
      {
        t: "Superior Autonomy",
        d: "Far more precise target tracking and fully autonomous mission execution through advanced sensor fusion.",
      },
    ],
  },

  golge: {
    role: "Combat UAV · Champion of Türkiye",
    desc: "The platform that won our team the Turkish championship at the 2022 TEKNOFEST Combat UAV competition. Its inverted V-tail architecture and high manoeuvrability kept it competitive in dogfight scenarios. The project closed in 2025.",
    specs: [
      { label: "Architecture", value: "Inverted V-Tail" },
      { label: "Mission", value: "Air-to-Air Combat" },
      { label: "Autonomy", value: "Fully Autonomous" },
      { label: "Result", value: "1st in Türkiye" },
    ],
  },

  merlin: {
    role: "Fixed Wing · Payload",
    desc: "Designed against International UAV Competition criteria, Merlin pairs a high payload capacity with a modular architecture. It packs into a compact carry case and is flight-ready in 1 minute 46 seconds.",
    specs: [
      { label: "Assembly", value: "1 min 46 s" },
      { label: "Target Payload Ratio", value: "2.5× its own weight" },
      { label: "Structure", value: "Modular" },
      { label: "Mission", value: "Autonomous Payload Drop" },
    ],
  },

  jaeger: {
    role: "SAE AERO DESIGN · World Champion",
    desc: "The biomimetic, modular design that took the World Championship at SAE Aero Design East in the USA in 2017. With a 55-second assembly time it remains the cornerstone of our design discipline.",
    specs: [
      { label: "Airframe Weight", value: "305 g" },
      { label: "Payload", value: "1287 g" },
      { label: "Efficiency", value: "3.1× empty weight" },
      { label: "Assembly", value: "55 seconds" },
    ],
  },

  dorje: {
    codename: "Fixed Wing",
    role: "International UAV Competition",
    desc: "Designed by our former academic advisor Lect. Dr. Emre Özbek, DORJE competed in the fixed-wing category of the International UAV Competition.",
    specs: [
      { label: "Configuration", value: "Fixed Wing" },
      { label: "Category", value: "International UAV" },
    ],
  },

  hydra: {
    role: "R&D · Hydrogen Propulsion",
    desc: "A UAV programme running on advanced PEM fuel-cell technology, built around zero-emission, long-endurance flight. It marries a hydrogen propulsion system with avionics developed in-house.",
    specs: [
      { label: "Propulsion", value: "PEM Fuel Cell" },
      { label: "Emissions", value: "Zero" },
      { label: "Goal", value: "Long Range" },
      { label: "Status", value: "In Development" },
    ],
  },
};

/* ---------- DEPARTMANLAR ---------- */

/** key → İngilizce ad ve açıklamalar. `short` bilerek boş: İngilizcede
    ad zaten İngilizce, üstüne bir de aynı etiketi basmanın anlamı yok. */
export const DEPARTMENTS_EN: Record<
  string,
  Pick<Department, "name" | "short" | "desc" | "detail">
> = {
  yazilim: {
    name: "Software",
    short: "",
    desc: "Autonomous flight software, computer vision and artificial intelligence.",
    detail:
      "Builds autonomous flight software, computer vision and AI. Guidance algorithms, target tracking and the ground control station all come out of this team.",
  },
  tasarim: {
    name: "Design",
    short: "",
    desc: "Overall aircraft design and component design.",
    detail:
      "Owns the overall aircraft design and the design of individual components. Aerodynamic shaping, CAD modelling and simulation validation sit with this team.",
  },
  kompozit: {
    name: "Composites",
    short: "",
    desc: "Composite production by vacuum infusion and hand lay-up.",
    detail:
      "Produces composite parts using vacuum infusion and hand lay-up. Builds light, durable airframe parts from carbon fibre and fibreglass.",
  },
  aviyonik: {
    name: "Avionics",
    short: "",
    desc: "Aircraft electronics and autopilot integration.",
    detail:
      "Works on aircraft electronics and autopilot integration. Sensor fusion, power distribution and the telemetry stack are built here.",
  },
  yapisal: {
    name: "Structures",
    short: "",
    desc: "Component manufacturing, repair and assembly.",
    detail:
      "Handles component manufacturing, repair and assembly. Assembly processes and field maintenance belong to this team.",
  },
  medya: {
    name: "Media & Partnerships",
    short: "",
    desc: "Promotion, social media and sponsor relations.",
    detail:
      "Promotes the team on social media, runs publicity work and manages sponsorships. Corporate relations and budget management also sit with this team.",
  },
};

/* ---------- SÜREÇ ---------- */

/** adım numarası → İngilizce başlık ve açıklama */
export const PROCESS_EN: Record<string, { t: string; d: string }> = {
  "01": {
    t: "Design",
    d: "We start from mission requirements and build the aerodynamic and structural design in CAD. Every part is simulated before it ever flies.",
  },
  "02": {
    t: "Manufacturing",
    d: "We produce parts with composite moulding, CNC and 3D printing. A carbon-fibre airframe: light and strong.",
  },
  "03": {
    t: "Integration",
    d: "We integrate avionics, power systems and autonomous software into the airframe. Ground tests and simulation validation happen at this stage.",
  },
  "04": {
    t: "Flight & Analysis",
    d: "Field test flights, telemetry logging and analysis. Every flight produces the data that feeds the next design.",
  },
};

/* ---------- SPONSORLUK ---------- */

type TierOverlay = Pick<SponsorTier, "label" | "matrix" | "perks">;

export const SPONSOR_TIERS_EN: Record<string, TierOverlay> = {
  first: {
    label: "Main Sponsor",
    matrix: {
      logoUcak: "Largest — approx. 20×20 cm",
      sosyalMedya:
        "Pinned post, a video dedicated to your company, plus every benefit of the lower tiers",
      uretimGunlugu: "A dedicated YouTube segment plus all other benefits",
      basiliMateryal: "Largest",
      logoKiyafet: "Largest, on the back — approx. 15×15 cm",
      urunTest:
        "Durability report over 15+ sorties between −10°C and +45°C, with the full test analysis shared",
    },
    perks: [
      "Large logo placement on the aircraft",
      "Large logo on the upper back of the team shirt",
      "Large logo on competition and exhibition roll-ups",
      "Priority access to meet team members",
      "The right to host an information seminar on behalf of your company",
      "Logo and company feature on social media (at least one post per month)",
      "Social media posts on request",
      "Access to the CV file (résumés of every team member)",
      "A personalised letter of thanks from the team",
    ],
  },

  business: {
    label: "Solution Partner",
    matrix: {
      logoUcak: "Medium — approx. 10×15 cm",
      sosyalMedya:
        "Solution-partner post, brand features (monthly), plus Economy Class benefits",
      uretimGunlugu: "Brand mention in the videos",
      basiliMateryal: "Medium",
      logoKiyafet: "Medium — approx. 10×10 cm",
      urunTest: "Test report over 3 sorties between −10°C and +45°C",
    },
    perks: [
      "Medium logo placement on the aircraft",
      "Medium logo on the back of the team shirt",
      "Medium logo on competition and exhibition roll-ups",
      "The right to host an information seminar on behalf of your company",
      "Social media posts featuring your company (at least one every two months)",
      "Access to the CV file",
      "A personalised letter of thanks from the team",
    ],
  },

  economy: {
    label: "Supporter",
    matrix: {
      logoUcak: "Small — approx. 7.5×10 cm",
      sosyalMedya: "Support posts, product placement in the videos",
      uretimGunlugu: "Product placement in the videos",
      basiliMateryal: "Listed by name",
      logoKiyafet: "Small — approx. 5×7.5 cm",
      urunTest: "—",
    },
    perks: [
      "Small logo placement on the aircraft",
      "Small logo on the back of the team shirt",
      "Small logo on competition and exhibition roll-ups",
      "Logo and company feature on social media (at least one post per quarter)",
      "A personalised letter of thanks from the team",
    ],
  },
};

/** Karşılaştırma tablosu satır başlıkları */
export const SPONSOR_MATRIX_ROWS_EN: Record<string, string> = {
  logoUcak: "Logo on the UAV airframe",
  logoKiyafet: "Logo on team apparel",
  sosyalMedya: "Social media posts",
  uretimGunlugu: '"Build Log" video sponsorship',
  basiliMateryal: "Printed materials (posters, roll-ups)",
  urunTest: "Product testing and reporting",
};

export const SPONSOR_NOTE_EN =
  "Our sponsorship packages are not limited to cash support. Where you cover " +
  "technical equipment, raw materials or services the team needs, every right " +
  "in the matching sponsorship tier is granted on the basis of the market " +
  "value of that support.";

/** SPONSOR_REASONS ile aynı sırada */
export const SPONSOR_REASONS_EN: { t: string; d: string }[] = [
  {
    t: "Brand Visibility and Reputation",
    d: "Your logo appears on our aircraft, our team apparel, our social media content and our competition presentations. Your brand stands out at events such as TEKNOFEST that reach millions of people.",
  },
  {
    t: "Access to a Qualified Talent Pool",
    d: "Every member of our team has hands-on experience in UAV technology and engineering. We are an ideal talent pool for internships, part-time roles and graduate hiring.",
  },
  {
    t: "Product Testing and R&D Collaboration",
    d: "We test your products — adhesives, electronic components, sensors — under extreme flight conditions: high speed, vibration, varying altitudes. We analyse the performance data and give you technical feedback.",
  },
  {
    t: "Corporate Social Responsibility",
    d: "While investing in Türkiye's future you contribute directly to the careers of young engineers and become part of a sustainable education ecosystem.",
  },
  {
    t: "A Dedicated Sponsorship Portfolio",
    d: "Bespoke reporting that highlights your contribution across every achievement, event and media appearance through the year — concrete content and metrics for your own social responsibility reports.",
  },
];

/** Sponsor adı → İngilizce rol etiketi */
export const SPONSOR_ROLE_EN: Record<string, string> = {
  "Ana Sponsor": "Main Sponsor",
  "Ürün Sponsoru": "Product Sponsor",
  Destekçi: "Supporter",
};

/* ---------- KİŞİLER ---------- */

/** Türkçe ad → İngilizce ad ve unvan */
export const ADVISORS_EN: Record<string, { name: string; role: string }> = {
  "Dr. Öğr. Üyesi Emre ÖZBEK": {
    name: "Asst. Prof. Dr. Emre ÖZBEK",
    role: "Academic Advisor",
  },
  "Ar. Gör. Mustafa AZER": {
    name: "Res. Asst. Mustafa AZER",
    role: "Academic Advisor",
  },
  "Dr. İbrahim Yavuz DAL": {
    name: "Dr. İbrahim Yavuz DAL",
    role: "Advisor Pilot",
  },
};

/** Türkçe unvan → İngilizce unvan */
export const LEAD_ROLE_EN: Record<string, string> = {
  "Takım Kaptanı": "Team Captain",
  "Takım Kaptan Yardımcısı": "Deputy Team Captain",
};
