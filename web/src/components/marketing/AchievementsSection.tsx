"use client";

import { Trophy } from "lucide-react";
import { useAchievements } from "@/lib/content";
import { S, useT } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

/**
 * Başarılar — dikey zaman çizelgesi.
 *
 * Önceden iki sütunlu kart ızgarasıydı; hangi derecenin hangi yıla ait
 * olduğu okunmuyordu. Artık tek bir çizgi yukarıdan aşağı iniyor ve her
 * yıl kendi düğümünde toplanıyor, o yıl birden fazla derece varsa alt
 * alta listeleniyor.
 */
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
          {/* Dikey çizgi — düğümlerin arkasından geçer */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[11px] top-3 w-px bg-[linear-gradient(180deg,var(--accent),var(--line)_70%,transparent)] sm:left-[calc(5.5rem+11px)]"
          />

          {yillar.map(([yil, liste], i) => {
            const oneCikan = liste.some((a) => a.highlight);
            return (
              <li key={yil} className="relative pb-10 last:pb-0">
                <Reveal delay={Math.min(i, 5) * 60}>
                  <div className="flex gap-5 sm:gap-0">
                    {/* Yıl — geniş ekranda çizginin solunda */}
                    <div className="hidden w-22 shrink-0 pr-6 text-right sm:block">
                      <span
                        className={`display tabular text-2xl ${
                          oneCikan ? "text-accent" : "text-ink-3"
                        }`}
                      >
                        {yil}
                      </span>
                    </div>

                    {/* Düğüm */}
                    <div className="relative shrink-0">
                      <span
                        className={`mt-2 block size-[23px] rounded-full border-4 border-bg-1 ${
                          oneCikan ? "bg-accent" : "bg-ink-3"
                        }`}
                      />
                    </div>

                    {/* İçerik */}
                    <div className="min-w-0 flex-1 pl-5 sm:pl-7">
                      <span
                        className={`display tabular text-xl sm:hidden ${
                          oneCikan ? "text-accent" : "text-ink-3"
                        }`}
                      >
                        {yil}
                      </span>

                      <ul className="mt-1 space-y-3 sm:mt-0">
                        {liste.map((a) => (
                          <li
                            key={a.title + a.detail}
                            className={`flex items-start gap-4 rounded-2xl border p-5 transition-colors ${
                              a.highlight
                                ? "border-accent/35 bg-[linear-gradient(135deg,var(--accent-soft),transparent_60%)]"
                                : "border-line bg-bg hover:border-line-2"
                            }`}
                          >
                            <span
                              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                                a.highlight
                                  ? "bg-accent text-white"
                                  : "bg-bg-2 text-ink-3"
                              }`}
                            >
                              {a.highlight ? (
                                <Trophy size={18} />
                              ) : (
                                <span className="display tabular text-base">
                                  {a.rank}
                                </span>
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-bold leading-snug text-ink">
                                {a.title}
                              </span>
                              <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-2">
                                {a.detail}
                              </span>
                              <span className="eyebrow mt-2 block !text-[9.5px]">
                                {a.scope === "uluslararasi"
                                  ? t(S.basarilar.uluslararasi)
                                  : t(S.basarilar.ulusal)}
                                {a.highlight
                                  ? ` · ${t(S.basarilar.sampiyonluk)}`
                                  : ""}
                              </span>
                            </span>
                          </li>
                        ))}
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
