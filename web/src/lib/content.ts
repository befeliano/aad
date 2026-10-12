"use client";

/* ============================================================
   Dile göre içerik.

   Bileşenler constants.ts'i doğrudan okumak yerine buradaki
   kancaları çağırır; Türkçe seçiliyken kaynak dizi olduğu gibi,
   İngilizce seçiliyken constants-en.ts katmanı uygulanmış hâli
   döner. Bir çeviri eksikse Türkçesi görünür — sayfa asla boş
   kalmaz.
   ============================================================ */

import { useMemo } from "react";
import { useLang } from "./i18n";
import {
  ADVISORS,
  DEPARTMENTS,
  FLEET,
  PROCESS_STEPS,
  SPONSORS_2025,
  SPONSOR_REASONS,
  TEAM_LEADS,
  type Aircraft,
  type Department,
} from "./constants";
import {
  ADVISORS_EN,
  DEPARTMENTS_EN,
  FLEET_EN,
  LEAD_ROLE_EN,
  PROCESS_EN,
  SPONSOR_REASONS_EN,
  SPONSOR_ROLE_EN,
} from "./constants-en";

/* ---------- FİLO ---------- */

export function useFleet(): Aircraft[] {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return FLEET;
    return FLEET.map((ac) => {
      const ov = FLEET_EN[ac.slug];
      if (!ov) return ac;
      return {
        ...ac,
        codename: ov.codename ?? ac.codename,
        role: ov.role ?? ac.role,
        desc: ov.desc ?? ac.desc,
        specs: ov.specs ?? ac.specs,
        features: ov.features ?? ac.features,
      };
    });
  }, [lang]);
}

/* ---------- BAŞARILAR ---------- */

export function useAchievements(): Achievement[] {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return ACHIEVEMENTS;
    return ACHIEVEMENTS.map((a) => {
      const ov = ACHIEVEMENTS_EN[`${a.year}|${a.title[0]}`];
      return {
        ...a,
        title: [a.title[0], ov?.title ?? a.title[1]] as const,
        detail: [a.detail[0], ov?.detail ?? a.detail[1]] as const,
        rank: RANK_EN[a.rank] ?? a.rank,
      };
    });
  }, [lang]);
}

/* ---------- DEPARTMANLAR ---------- */

export function useDepartments(): Department[] {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return DEPARTMENTS;
    return DEPARTMENTS.map((d) => {
      const ov = DEPARTMENTS_EN[d.key];
      return ov ? { ...d, ...ov } : d;
    });
  }, [lang]);
}

/* ---------- SÜREÇ ---------- */

export function useProcessSteps(): typeof PROCESS_STEPS {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return PROCESS_STEPS;
    return PROCESS_STEPS.map((s) => {
      const ov = PROCESS_EN[s.n];
      return ov ? { ...s, ...ov } : s;
    });
  }, [lang]);
}

/* ---------- SPONSORLUK ---------- */

export function useSponsorReasons(): typeof SPONSOR_REASONS {
  const lang = useLang();
  return lang === "tr" ? SPONSOR_REASONS : SPONSOR_REASONS_EN;
}

export function useSponsors(): typeof SPONSORS_2025 {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return SPONSORS_2025;
    return SPONSORS_2025.map((s) => ({
      ...s,
      role: SPONSOR_ROLE_EN[s.role] ?? s.role,
    }));
  }, [lang]);
}

/* ---------- KİŞİLER ---------- */

export function useAdvisors(): typeof ADVISORS {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return ADVISORS;
    return ADVISORS.map((a) => ADVISORS_EN[a.name] ?? a);
  }, [lang]);
}

export function useTeamLeads(): typeof TEAM_LEADS {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return TEAM_LEADS;
    return TEAM_LEADS.map((l) => ({
      ...l,
      role: LEAD_ROLE_EN[l.role] ?? l.role,
    }));
  }, [lang]);
}
