/* ============================================================
   İngilizce içerik katmanı.

   constants.ts Türkçe kaynaktır ve tek doğruluk kaynağı olarak kalır.
   Burada yalnızca ÇEVİRİLER var; her giriş kaynaktaki kalıcı bir
   kimliğe (slug / key / ad) bağlı. Böylece Türkçe metin değişince
   İngilizcesi sessizce eskimiyor — eşleşme kimlik üzerinden kuruluyor.

   Kullanım: doğrudan içeri almayın, `@/lib/content` içindeki
   use* kancalarını çağırın.
   ============================================================ */

import type { Aircraft, Department } from "./constants";

/* ---------- FİLO ---------- */

type FleetOverlay = Partial<
  Pick<Aircraft, "role" | "desc" | "codename" | "specs" | "features">
>;

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
  { key: "year", label: "Year" },
  { key: "fuselage", label: "Fuselage" },
  { key: "wing", label: "Wing" },
  { key: "tail", label: "Tail" },
  { key: "wingPosition", label: "Wing Position" },
  { key: "tailConfiguration", label: "Tail Configuration" },
  { key: "landingGear", label: "Landing Gear" },
  { key: "motorPosition", label: "Motor Position" },
  { key: "takeoffWeight", label: "Take-off Weight" },
];

function aircraftSpecs(
  values: Partial<Record<AircraftSpecKey, string>> = {}
): NonNullable<Aircraft["specs"]> {
  return AIRCRAFT_SPEC_FIELDS.map(({ key, label }) => ({
    label,
    value: values[key] ?? "",
  }));
}

/** slug → İngilizce künye */
export const FLEET_EN: Record<string, FleetOverlay> = {
  daban: {
    codename: "In Development",
    role: "Planned Aircraft",
    desc: "Our next aircraft, to be built entirely from composites. It is currently in the design stage.",
    specs: aircraftSpecs({
      year: "In development",
      fuselage: "Composite",
      wing: "Composite",
      tail: "Composite",
      tailConfiguration: "Standard",
      landingGear: "Present",
      motorPosition: "Nose-mounted twin motors",
    }),
  },

  golge: {
    codename: "2026",
    role: "Combat UAV",
    desc: "Our inverted V-tail aircraft for the Combat UAV competition. It will fly both air-to-air and air-to-ground missions; work is ongoing.",
    specs: aircraftSpecs({
      year: "2026",
      fuselage: "Composite",
      tailConfiguration: "Inverted V-tail",
      landingGear: "Present",
      motorPosition: "Rear-mounted",
    }),
    features: [
      {
        t: "Purpose",
        d: "Fire detection",
      },
      {
        t: "Outcome",
        d: "Combat UAV competition aircraft",
      },
      {
        t: "Mission Profiles",
        d: "Air-to-air and air-to-ground missions",
      },
      {
        t: "Autonomy",
        d: "The goal is to fly the whole mission autonomously.",
      },
    ],
  },

  merlin: {
    role: "TÜBİTAK International UAV Competition",
    desc: "Built for the TÜBİTAK International UAV Competition, Merlin can carry 2.5 times its own weight. It breaks down to fit a small case, and going from case to flight-ready takes 1 minute 46 seconds.",
    specs: aircraftSpecs({
      year: "2025",
      tailConfiguration: "Standard",
      landingGear: "None",
      motorPosition: "Nose-mounted",
    }),
    features: [
      {
        t: "Modular Design",
        d: "Breaks down to fit a small carry case.",
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
    desc: "The cargo aircraft we flew at SAE Aero Design East 2017; it comes apart into modules.",
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
        t: "Purpose",
        d: "High payload ratio",
      },
      {
        t: "Outcome",
        d: "High payload capacity",
      },
      {
        t: "Biomimetic Design",
        d: "We took inspiration from structures in nature and the way animals move.",
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
    desc: "Our entry in the fixed-wing category of the TÜBİTAK International UAV Competition.",
    specs: aircraftSpecs({
      year: "2025",
      tailConfiguration: "Standard",
      landingGear: "Present",
      motorPosition: "Nose-mounted",
    }),
    features: [
      {
        t: "Fixed-Wing Category",
        d: "Designed for the TÜBİTAK International UAV Competition.",
      },
    ],
  },

  hydra: {
    role: "R&D · Hydrogen Propulsion",
    codename: "2020",
    desc: "Our research aircraft that flies on a hydrogen fuel cell. The aim: long-range flight with zero emissions.",
    specs: aircraftSpecs({
      year: "2020",
      fuselage: "Composite",
      wing: "EPS Foam",
      tail: "Birch + Balsa Covering",
      wingPosition: "High Wing",
      tailConfiguration: "T-tail",
      landingGear: "None",
      motorPosition: "Nose-mounted",
    }),
    features: [
      {
        t: "Hydrogen Fuel System",
        d: "Powered by a hydrogen fuel cell; the target is long range with zero emissions.",
      },
    ],
  },

  bumblebee: {
    specs: aircraftSpecs({
      year: "2015",
      tailConfiguration: "Standard",
      landingGear: "Present",
      motorPosition: "Nose-mounted",
    }),
  },
  atlas: {
    specs: aircraftSpecs({
      year: "2016",
      tailConfiguration: "Standard",
      landingGear: "None",
      motorPosition: "Nose-mounted",
    }),
  },
  tardis: {
    specs: aircraftSpecs({
      year: "2016",
      tailConfiguration: "Pi-tail",
      landingGear: "Present",
      motorPosition: "Rear-mounted",
    }),
  },
  balerin: {
    specs: aircraftSpecs({
      year: "2018",
      tailConfiguration: "Standard",
      landingGear: "None",
      motorPosition: "Nose-mounted",
    }),
  },
  smartquad: { specs: aircraftSpecs({ year: "2018" }) },
  tulpar: {
    specs: aircraftSpecs({
      year: "2018",
      tailConfiguration: "Inverted U-tail",
      landingGear: "None",
      motorPosition: "Nose-mounted",
    }),
  },
  harpy: {
    specs: aircraftSpecs({
      year: "2018",
      tailConfiguration: "Standard",
      landingGear: "Present",
      motorPosition: "Nose-mounted",
    }),
  },
  foton: {
    specs: aircraftSpecs({
      year: "2019",
      tailConfiguration: "Standard",
      landingGear: "None",
      motorPosition: "Nose-mounted",
    }),
  },
};

/* ---------- BAŞARILAR ---------- */

/** `${year}|${title}` → İngilizce başlık ve açıklama */
export const ACHIEVEMENTS_EN: Record<string, { title: string; detail: string }> =
  {
    "2022|TEKNOFEST Savaşan İHA": {
      title: "TEKNOFEST Combat UAV",
      detail: "Champion of Türkiye",
    },
    "2018|TEKNOFEST TÜBİTAK İHA": {
      title: "TEKNOFEST TÜBİTAK UAV",
      detail: "First place in Türkiye",
    },
    "2017|SAE Aero Design East (ABD)": {
      title: "SAE Aero Design East (USA)",
      detail: "World Championship — with Jaeger",
    },
    "2022|TEKNOFEST Karma Sürü Simülasyon": {
      title: "TEKNOFEST Mixed Swarm Simulation",
      detail: "Third place",
    },
    "2021|TEKNOFEST Savaşan İHA": {
      title: "TEKNOFEST Combat UAV",
      detail: "Second place",
    },
    "2020|TEKNOFEST Sürü İHA": {
      title: "TEKNOFEST Swarm UAV",
      detail: "Second place",
    },
    "2019|TEKNOFEST TÜBİTAK İHA": {
      title: "TEKNOFEST TÜBİTAK UAV",
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
    desc: "Writes the autonomous mission software, image-processing algorithms and the ground-station interface.",
    detail:
      "Responsible for carrying out the aircraft's autonomous missions, including target tracking, locking and kamikaze missions, and for developing image-processing algorithms and the ground-station interface.",
  },
  tasarim: {
    name: "Design",
    short: "",
    desc: "Does the aircraft's aerodynamic design, 3D model and performance analysis.",
    detail:
      "Responsible for the aircraft's aerodynamic design, 3D modelling and performance analysis. It designs the technical drawings, manufacturing templates and auxiliary fixtures required for manufacturing and assembly, and prepares the relevant technical guides.",
  },
  kompozit: {
    name: "Composites",
    short: "",
    desc: "Builds critical structural parts from composites and does materials R&D.",
    detail:
      "Responsible for manufacturing critical structural components of the designed aircraft, including parts of the fuselage, wing and landing gear, using materials such as carbon fibre, glass fibre and epoxy. Related R&D work helps reduce aircraft weight and improve strength.",
  },
  aviyonik: {
    name: "Avionics",
    short: "",
    desc: "Builds the aircraft's electronics, communications and autonomous control systems.",
    detail:
      "Responsible for end-to-end management of the aircraft's electronic, communication and autonomous control systems. This includes integrating hardware for autonomous flight and mission mechanisms, configuring energy and power distribution systems, optimizing flight-control parameters, establishing the telemetry link between the aircraft and ground station, and installing inter-system wiring in accordance with aviation standards.",
  },
  yapisal: {
    name: "Structures",
    short: "",
    desc: "Handles the aircraft's production, assembly and mechanical integration.",
    detail:
      "Responsible for the physical production, assembly and mechanical integration of designed unmanned aircraft. This includes manufacturing and assembling primary structures such as wings, fuselage and tail, and integrating the required mechanical systems. Pre-flight structural inspections and durability tests are also carried out to ensure the aircraft is safe and ready to fly.",
  },
  medya: {
    name: "Social Media & Sponsorship",
    short: "",
    desc: "Runs social media, the team's visual identity and sponsor relations.",
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
    d: "We make parts with composite moulding, CNC and 3D printing, and use carbon fibre for the airframe because it is light and strong.",
  },
  "03": {
    t: "Integration",
    d: "We fit the avionics, power system and autonomous software into the airframe, then check everything with ground tests and simulation before flying.",
  },
  "04": {
    t: "Flight & Analysis",
    d: "We fly test flights in the field and go through the telemetry logs. What we learn shapes the next design.",
  },
};

/* ---------- SPONSORLUK ---------- */

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
    d: "Your support directly helps students gain hands-on engineering experience they would not get in class.",
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
