"use client";

import Image from "next/image";
import { FLEET_ARCHIVE } from "@/lib/constants";
import { useFleet } from "@/lib/content";
import { S, useT } from "@/lib/i18n";
import { AircraftSprite } from "./AircraftSprite";
import { Reveal } from "@/components/ui/Reveal";

/**
 * /filo sayfasının gövdesi.
 *
 * Görsel yolları sunucuda okunup prop olarak geliyor; bileşenin kendisi
 * dile bağlı olduğu için istemcide çalışıyor.
 */
export function FiloListesi({
  images,
}: {
  images: Record<string, string | null>;
}) {
  const t = useT();
  const fleet = useFleet();

  return (
    <>
      <div className="space-y-8">
        {fleet.map((ac, i) => {
          const img = images[ac.slug] ?? null;
          const alt = `${ac.name} ${t(S.filo.ihaAlt)}`;
          return (
            <Reveal key={ac.name} delay={Math.min(i, 3) * 70}>
              <article
                className={`overflow-hidden rounded-2xl border bg-bg-1 transition-colors hover:border-line-2 ${
                  ac.flagship ? "border-accent/40" : "border-line"
                }`}
              >
                {/* ÜST BÖLÜM */}
                <div className="grid gap-0 lg:grid-cols-[minmax(0,52%)_minmax(0,48%)]">
                  {/* Görsel */}
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-bg-2 lg:border-b-0 lg:border-r">
                    {img ? (
                      <Image
                        src={img}
                        alt={alt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 620px"
                        className="object-cover"
                      />
                    ) : ac.sprite ? (
                      <AircraftSprite
                        box={ac.sprite}
                        alt={alt}
                        className="size-full"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "radial-gradient(circle at 62% 32%, var(--accent-soft), transparent 62%)",
                        }}
                      />
                    )}
                    <span
                      className={`eyebrow absolute left-4 top-3.5 !text-[10px] ${
                        img || ac.sprite
                          ? "rounded-full bg-black/55 px-2.5 py-1 !text-white backdrop-blur-sm"
                          : ""
                      }`}
                    >
                      {ac.codename}
                    </span>
                    {ac.flagship && (
                      <span className="absolute right-4 top-3.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        {t(S.filo.amiralGemisi)}
                      </span>
                    )}
                  </div>

                  {/* Künye */}
                  <div className="p-6 sm:p-8">
                    <div className="eyebrow">{ac.role}</div>
                    <h2
                      className={`display-tight mt-2 text-ink ${
                        ac.flagship
                          ? "text-4xl sm:text-6xl"
                          : "text-3xl sm:text-4xl"
                      }`}
                    >
                      {ac.name}
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-ink-2">
                      {ac.desc}
                    </p>
                  </div>
                </div>

                {/* ALT BÖLÜM: Detaylı Özellikler ve Spekler */}
                {(ac.features || ac.specs) && (
                  <div className="border-t border-line bg-bg-2/30 p-6 sm:p-8">
                    {/* Özellikler */}
                    {ac.features && (
                      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {ac.features.map((f) => (
                          <li key={f.t}>
                            <span className="text-[13.5px] font-bold text-ink">
                              {f.t}
                            </span>
                            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-3">
                              {f.d}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Teknik Değerler (Grid yerine arka plansız, ortalanmış Flexbox) */}
                    {ac.specs && (
                      <dl
                        className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-6 ${
                          ac.features ? "mt-10 border-t border-line/50 pt-8" : ""
                        }`}
                      >
                        {ac.specs.map((s) => (
                          <div key={s.label} className="flex flex-col items-center text-center">
                            <dt className="eyebrow !text-[9.5px]">{s.label}</dt>
                            <dd className="mt-1.5 text-[15px] font-semibold text-ink">
                              {s.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>

      {/* Arşiv */}
      <Reveal>
        <div className="mt-10 rounded-2xl border border-line bg-bg-1 p-7">
          <div className="eyebrow mb-4">{t(S.filo.arsiv)}</div>
          <ul className="flex flex-wrap gap-2">
            {FLEET_ARCHIVE.map((a) => (
              <li
                key={a.name}
                className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-2"
              >
                <span className="font-semibold text-ink">{a.name}</span>
                <span className="tabular ml-1.5 text-ink-3">{a.year}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </>
  );
}
