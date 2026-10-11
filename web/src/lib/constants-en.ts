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

const EMPTY_AIRCRAFT_SPECS: NonNullable<Aircraft["specs"]> = [
  { label: "Fuselage", value: "" },
  { label: "Wing", value: "" },
  { label: "Tail", value: "" },
  { label: "Wing Position", value: "" },
  { label: "Tail Configuration", value: "" },
  { label: "Landing Gear", value: "" },
  { label: "Motor Position", value: "" },
];

/** slug → İngilizce künye */
export const FLEET_EN: Record<string, FleetOverlay> = {
  daban: {
    codename: "In Development",
    role: "Planned Aircraft",
    desc: "DABAN is our planned full-composite aircraft. Design work is ongoing.",
    specs: [
      { label: "Fuselage", value: "Full composite" },
      { label: "Wing", value: "" },
      { label: "Tail", value: "" },
      { label: "Wing Position", value: "" },
      { label: "Tail Configuration", value: "" },
      { label: "Landing Gear", value: "" },
      { label: "Motor Position", value: "" },
    ],
    features: [
      {
        t: "Wingspan",
        d: "Planned at 2.6 m.",
      },
      {
        t: "Take-off Weight",
        d: "Planned at 8 kg.",
      },
      {
        t: "Length",
        d: "Planned at 1.85 m.",
      },
      {
        t: "Motor",
        d: "2× T-Motor AT3520",
      },
      {
        t: "Camera",
        d: "Hikrobot MV CS050",
      },
      {
        t: "Flight Control System",
        d: "CUAV V6X",
      },
    ],
  },

  golge: {
    codename: "2026",
    role: "Combat UAV",
    desc: "Development of the GÖLGE platform is ongoing. Its inverted V-tail is designed for both air-to-air and air-to-ground missions.",
    specs: [
      { label: "Fuselage", value: "" },
      { label: "Wing", value: "" },
      { label: "Tail", value: "" },
      { label: "Wing Position", value: "" },
      { label: "Tail Configuration", value: "Inverted V" },
      { label: "Landing Gear", value: "" },
      { label: "Motor Position", value: "" },
    ],
    features: [
      {
        t: "Mission Profiles",
        d: "Developed for air-to-air and air-to-ground missions.",
      },
      {
        t: "Autonomy",
        d: "Fully autonomous mission execution is planned.",
      },
    ],
  },

  merlin: {
    role: "TÜBİTAK International UAV Competition",
    desc: "Designed to the criteria of the TÜBİTAK International UAV Competition, Merlin pairs a high payload capacity with a modular architecture. It packs into a compact carry case and is flight-ready in 1 minute 46 seconds.",
    specs: [
      { label: "Fuselage", value: "" },
      { label: "Wing", value: "" },
      { label: "Tail", value: "" },
      { label: "Wing Position", value: "" },
      { label: "Tail Configuration", value: "" },
      { label: "Landing Gear", value: "" },
      { label: "Motor Position", value: "" },
    ],
    features: [
      {
        t: "Modular Design",
        d: "Designed to fit in a compact transport case.",
      },
      {
        t: "Setup Time",
        d: "1 minute 46 seconds",
      },
      {
        t: "Mission",
        d: "Autonomous payload drop",
      },
      {
        t: "Payload Ratio",
        d: "2.5 times its own weight",
      },
    ],
  },

  jaeger: {
    role: "SAE Aero Design",
    desc: "A modular aircraft used in the 2017 SAE Aero Design East competition.",
    specs: [
      { label: "Fuselage", value: "" },
      { label: "Wing", value: "" },
      { label: "Tail", value: "" },
      { label: "Wing Position", value: "" },
      { label: "Tail Configuration", value: "" },
      { label: "Landing Gear", value: "" },
      { label: "Motor Position", value: "" },
    ],
    features: [
      {
        t: "Biomimetic Design",
        d: "Inspired by structures and forms of movement found in nature.",
      },
      {
        t: "Airframe Weight",
        d: "305 g",
      },
      {
        t: "Payload",
        d: "1,287 g",
      },
      {
        t: "Assembly Time",
        d: "55 seconds",
      },
    ],
  },

  dorje: {
    codename: "2025",
    role: "TÜBİTAK International UAV Competition",
    desc: "DORJE was developed for the fixed-wing category of the TÜBİTAK International UAV Competition.",
    specs: [
      { label: "Fuselage", value: "" },
      { label: "Wing", value: "Fixed wing" },
      { label: "Tail", value: "" },
      { label: "Wing Position", value: "" },
      { label: "Tail Configuration", value: "" },
      { label: "Landing Gear", value: "" },
      { label: "Motor Position", value: "" },
    ],
    features: [
      {
        t: "Fixed-Wing Category",
        d: "The aircraft was designed for the fixed-wing category of the TÜBİTAK International UAV Competition.",
      },
    ],
  },

  hydra: {
    role: "R&D · Hydrogen Propulsion",
    codename: "2020",
    desc: "An aircraft developed for zero-emission flight and long range, powered by a hydrogen fuel cell.",
    specs: [
      { label: "Fuselage", value: "Composite" },
      { label: "Wing", value: "EPS Foam" },
      { label: "Tail", value: "Birch + Balsa Covering" },
      { label: "Wing Position", value: "High Wing" },
      { label: "Tail Configuration", value: "T-tail" },
      { label: "Landing Gear", value: "None" },
      { label: "Motor Position", value: "Nose-mounted" },
    ],
    features: [
      {
        t: "Hydrogen Fuel System",
        d: "The aircraft runs on a hydrogen fuel cell and is being developed for zero-emission, long-range flight.",
      },
    ],
  },

  bumblebee: { specs: EMPTY_AIRCRAFT_SPECS },
  atlas: { specs: EMPTY_AIRCRAFT_SPECS },
  tardis: { specs: EMPTY_AIRCRAFT_SPECS },
  balerin: { specs: EMPTY_AIRCRAFT_SPECS },
  smartquad: { specs: EMPTY_AIRCRAFT_SPECS },
  tulpar: { specs: EMPTY_AIRCRAFT_SPECS },
  harpy: { specs: EMPTY_AIRCRAFT_SPECS },
  foton: { specs: EMPTY_AIRCRAFT_SPECS },
};

/* ---------- BAŞARILAR ---------- */

/** `${year}|${title}` → İngilizce başlık ve açıklama */
export const ACHIEVEMENTS_EN: Record<string, { title: string; detail: string }> =
  {
    "2022|TEKNOFEST Savaşan İHA": {
      title: "TEKNOFEST Combat UAV",
      detail: "1st Place",
    },
    "2018|TEKNOFEST TÜBİTAK Uluslararası İHA": {
      title: "TEKNOFEST TÜBİTAK International UAV",
      detail: "1st Place",
    },
    "2026|TEKNOFEST Savaşan İHA": {
      title: "TEKNOFEST Combat UAV",
      detail: "Finalist",
    },
    "2017|SAE Aero Design East": {
      title: "SAE Aero Design East",
      detail: "1st Place",
    },
    "2026|Anduril AI Grand Prix": {
      title: "Anduril AI Grand Prix",
      detail: "14th Place",
    },
    "2022|TEKNOFEST Karma Sürü Simülasyon": {
      title: "TEKNOFEST Mixed Swarm Simulation",
      detail: "Third place",
    },
    "2021|TEKNOFEST Savaşan İHA": {
      title: "TEKNOFEST Combat UAV",
      detail: "Fifth place",
    },
    "2025|TEKNOFEST Savaşan İHA": {
      title: "TEKNOFEST Combat UAV",
      detail: "Finalist",
    },
    "2025|TEKNOFEST TÜBİTAK Uluslararası İHA": {
      title: "TEKNOFEST TÜBİTAK International UAV",
      detail: "Finalist",
    },
    "2020|TEKNOFEST Sürü İHA": {
      title: "TEKNOFEST Swarm UAV",
      detail: "Second place",
    },
    "2019|TEKNOFEST TÜBİTAK Uluslararası İHA": {
      title: "TEKNOFEST TÜBİTAK International UAV",
      detail: "Fifth place",
    },
    "2016|SAE Aero Design": {
      title: "SAE Aero Design",
      detail: "Third overall",
    },
    "2015|Future Flight Design": {
      title: "Future Flight Design",
      detail: "Second overall",
    },
    "2014|SAE Aero Design": {
      title: "SAE Aero Design",
      detail: "Sixth overall",
    },
    "2013|SAE Aero Design": {
      title: "SAE Aero Design",
      detail: "Eleventh place",
    },
  };

/** "1." → "1st" — sıra ekleri dile göre değişir */
export const RANK_EN: Record<string, string> = {
  "1.": "1st",
  "2.": "2nd",
  "3.": "3rd",
  "4.": "4th",
  "5.": "5th",
  "6.": "6th",
  "11.": "11th",
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
    desc: "Autonomous missions, image-processing algorithms and ground-station interfaces are developed.",
    detail:
      "Responsible for carrying out the aircraft's autonomous missions, including target tracking, locking and kamikaze missions, and for developing image-processing algorithms and the ground-station interface.",
  },
  tasarim: {
    name: "Design",
    short: "",
    desc: "Aerodynamic design, 3D modelling and performance analysis are carried out.",
    detail:
      "Responsible for the aircraft's aerodynamic design, 3D modelling and performance analysis. It designs the technical drawings, manufacturing templates and auxiliary fixtures required for manufacturing and assembly, and prepares the relevant technical guides.",
  },
  kompozit: {
    name: "Composites",
    short: "",
    desc: "Critical structural components are produced from composite materials, alongside related R&D.",
    detail:
      "Responsible for manufacturing critical structural components of the designed aircraft, including parts of the fuselage, wing and landing gear, using materials such as carbon fibre, glass fibre and epoxy. Related R&D work helps reduce aircraft weight and improve strength.",
  },
  aviyonik: {
    name: "Avionics",
    short: "",
    desc: "Aircraft electronics, communications and autonomous control systems are managed end to end.",
    detail:
      "Responsible for end-to-end management of the aircraft's electronic, communication and autonomous control systems. This includes integrating hardware for autonomous flight and mission mechanisms, configuring energy and power distribution systems, optimizing flight-control parameters, establishing the telemetry link between the aircraft and ground station, and installing inter-system wiring in accordance with aviation standards.",
  },
  yapisal: {
    name: "Structures",
    short: "",
    desc: "Physical aircraft production, assembly and mechanical integration are carried out.",
    detail:
      "Responsible for the physical production, assembly and mechanical integration of designed unmanned aircraft. This includes manufacturing and assembling primary structures such as wings, fuselage and tail, and integrating the required mechanical systems. Pre-flight structural inspections and durability tests are also carried out to ensure the aircraft is safe and ready to fly.",
  },
  medya: {
    name: "Social Media & Sponsorship",
    short: "",
    desc: "Digital visibility, corporate identity and sponsorship processes are managed.",
    detail:
      "Responsible for increasing the team's visibility on digital platforms, strengthening its corporate identity and managing sponsorship processes. This includes preparing social media content, developing promotion and communication strategies, contacting potential sponsors, managing sponsorship agreements and supporting the sustainability of existing partnerships.",
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
    d: "Your logo appears on the team's aircraft, apparel, social media content and competition presentations. It is also visible at events such as TEKNOFEST.",
  },
  {
    t: "Access to a Qualified Talent Pool",
    d: "Team members gain practical experience in UAV technology and engineering. Internship and career opportunities can be discussed with the team.",
  },
  {
    t: "Product Testing and R&D Collaboration",
    d: "Products such as adhesives, electronic components and sensors are tested under flight conditions. Performance data is analysed and technical feedback is provided.",
  },
  {
    t: "Corporate Social Responsibility",
    d: "This support contributes to the career development of young engineers and supports a sustainable education ecosystem.",
  },
  {
    t: "A Dedicated Sponsorship Portfolio",
    d: "A dedicated report highlights your contribution across the year's achievements, events and media coverage, with content and metrics for social responsibility reporting.",
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
  "Dr. Öğr. Üy. Emre ÖZBEK": {
    name: "Asst. Prof. Dr. Emre ÖZBEK",
    role: "Academic Advisor",
  },
  "Araş. Gör. Mustafa AZER": {
    name: "Res. Asst. Mustafa AZER",
    role: "Academic Advisor",
  },
  "Öğr. Gör. Dr. İbrahim Yavuz DAL": {
    name: "Lect. Dr. İbrahim Yavuz DAL",
    role: "Advisor Pilot",
  },
};

/** Türkçe unvan → İngilizce unvan */
export const LEAD_ROLE_EN: Record<string, string> = {
  "Takım Kaptanı": "Team Captain",
  "Takım Kaptan Yardımcısı": "Deputy Team Captain",
};
