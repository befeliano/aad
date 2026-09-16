"use client";

import { Trophy, Award } from "lucide-react";
import { useAchievements } from "@/lib/content";
import { S, useT } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

function getRankConfig(rank: string | number) {
  const r = String(rank).replace(/\D/g, "");

  switch (r) {
    case "1": // Altın / Birincilik
      return {
        isMedal: true,
        showNumber: false,
        textColor: "text-amber-500",
        dotColor: "bg-amber-500",
        iconBg: "bg-amber-500 text-white",
        cardStyle:
          "border-amber-500/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),transparent_60%)]",
      };
    case "2": // Gümüş / İkincilik
      return {
        isMedal: true,
        showNumber: false,
        textColor: "text-slate-400",
        dotColor: "bg-slate-400",
        iconBg: "bg-slate-400 text-white",
        cardStyle:
          "border-slate-400/30 bg-[linear-gradient(135deg,rgba(148,163,184,0.08),transparent_60%)]",
      };
    case "3": // Bronz / Üçüncülük
      return {
        isMedal: true,
        showNumber: false,
        textColor: "text-orange-500",
        dotColor: "bg-orange-500",
        iconBg: "bg-orange-500 text-white",
        cardStyle:
          "border-orange-500/30 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),transparent_60%)]",
      };
    default: {
      const isUnranked = !r || r === "99";

      return {
        isMedal: false,
        showNumber: !isUnranked,
        rankNum: r,
        textColor: "text-ink-3",
        dotColor: "bg-accent",
        // Sade, nötr zemin + hafif kırmızı vurgulu ikon/metin
        iconBg: "bg-bg-2 text-accent border border-line",
        // Düz ve temiz kart, parlama/efekt yok
        cardStyle: "border-line bg-bg/60 hover:border-line-2",
      };
    }
  }
}

export function AchievementsSection() {
  const t = useT();
  const achievements = useAchievements();

  /* Yıla göre grupla, yeniden eskiye */
  const yillar = Object.entries(
    achievements.reduce<Record<string, typeof achievements>>((acc, a) => {
      (acc[a.year] ||= []).push(a);
      return acc;
    }, {})
  ).sort((a, b) => Number(b[0]) - Number(a[0]));

  return (
    <section id="basarilar" className="relative border-t border-line bg-bg-1">
      <div className="mx-auto max-w-5xl px-5 py-24 sm:px-8 sm:py-28">
        <SectionHeading
          num="02"
          title={t(S.basarilar.baslik)}
          kicker={t(S.basarilar.kicker)}
        />

        <ol className="relative mt-14">
          {/* Dikey çizgi */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[11px] top-3 w-px bg-[linear-gradient(180deg,var(--accent),var(--line)_70%,transparent)] sm:left-[calc(5.5rem+11px)]"
          />

          {yillar.map(([yil, liste], i) => {
            const bestRankNum = Math.min(
              ...liste.map((a) => {
                const num = Number(String(a.rank).replace(/\D/g, ""));
                return num > 0 ? num : 99;
              })
            );
            const yearConfig = getRankConfig(bestRankNum);

            return (
              <li key={yil} className="relative pb-10 last:pb-0">
                <Reveal delay={Math.min(i, 5) * 60}>
                  <div className="flex gap-5 sm:gap-0">
                    {/* Yıl — geniş ekran */}
                    <div className="hidden w-22 shrink-0 pr-6 text-right sm:block">
                      <span
                        className={`display tabular text-2xl font-bold tracking-tight ${yearConfig.textColor}`}
                      >
                        {yil}
                      </span>
                    </div>

                    {/* Düğüm */}
                    <div className="relative shrink-0">
                      <span
                        className={`mt-2 block size-[23px] rounded-full border-4 border-bg-1 ${yearConfig.dotColor}`}
                      />
                    </div>

                    {/* İçerik */}
                    <div className="min-w-0 flex-1 pl-5 sm:pl-7">
                      <span
                        className={`display tabular text-xl font-bold tracking-tight sm:hidden ${yearConfig.textColor}`}
                      >
                        {yil}
                      </span>

                      <ul className="mt-1 space-y-3 sm:mt-0">
                        {liste.map((a) => {
                          const rankConfig = getRankConfig(a.rank);

                          return (
                            <li
                              key={`${a.title[0]}-${a.detail[0]}-${a.year}`}
                              className={`flex items-start gap-4 rounded-2xl border p-5 ${rankConfig.cardStyle}`}
                            >
                              <span
                                className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-medium ${rankConfig.iconBg}`}
                              >
                                {rankConfig.isMedal ? (
                                  <Trophy size={18} />
                                ) : rankConfig.showNumber ? (
                                  <span className="display tabular text-sm font-semibold">
                                    #{rankConfig.rankNum}
                                  </span>
                                ) : (
                                  <Award size={18} />
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-bold leading-snug text-ink">
                                  {t(a.title)}
                                </span>
                                <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-2">
                                  {t(a.detail)}
                                </span>
                                <span className="eyebrow mt-2 block !text-[9.5px]">
                                  {a.scope === "uluslararasi"
                                    ? t(S.basarilar.uluslararasi)
                                    : t(S.basarilar.ulusal)}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}