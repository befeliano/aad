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
  ACHIEVEMENTS,
  ADVISORS,
  DEPARTMENTS,
  FLEET,
  PROCESS_STEPS,
  SPONSORS_2025,
  SPONSOR_MATRIX_ROWS,
  SPONSOR_NOTE,
  SPONSOR_REASONS,
  SPONSOR_TIERS,
  TEAM_LEADS,
  type Achievement,
  type Aircraft,
  type Department,
  type SponsorTier,
} from "./constants";
import {
  ACHIEVEMENTS_EN,
  ADVISORS_EN,
  DEPARTMENTS_EN,
  FLEET_EN,
  LEAD_ROLE_EN,
  PROCESS_EN,
  RANK_EN,
  SPONSOR_MATRIX_ROWS_EN,
  SPONSOR_NOTE_EN,
  SPONSOR_REASONS_EN,
  SPONSOR_ROLE_EN,
  SPONSOR_TIERS_EN,
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
      const ov = ACHIEVEMENTS_EN[`${a.year}|${a.title}`];
      return {
        ...a,
        title: ov?.title ?? a.title,
        detail: ov?.detail ?? a.detail,
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

export function useSponsorTiers(): SponsorTier[] {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return SPONSOR_TIERS;
    return SPONSOR_TIERS.map((t) => {
      const ov = SPONSOR_TIERS_EN[t.key];
      return ov ? { ...t, ...ov } : t;
    });
  }, [lang]);
}

export function useSponsorMatrixRows(): typeof SPONSOR_MATRIX_ROWS {
  const lang = useLang();
  return useMemo(() => {
    if (lang === "tr") return SPONSOR_MATRIX_ROWS;
    return SPONSOR_MATRIX_ROWS.map((r) => ({
      ...r,
      label: SPONSOR_MATRIX_ROWS_EN[r.key] ?? r.label,
    }));
  }, [lang]);
}

export function useSponsorReasons(): typeof SPONSOR_REASONS {
  const lang = useLang();
  return lang === "tr" ? SPONSOR_REASONS : SPONSOR_REASONS_EN;
}

export function useSponsorNote(): string {
  const lang = useLang();
  return lang === "tr" ? SPONSOR_NOTE : SPONSOR_NOTE_EN;
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
