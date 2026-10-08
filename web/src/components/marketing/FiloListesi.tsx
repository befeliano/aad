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
                className="overflow-hidden rounded-2xl border border-line bg-bg-1 transition-colors hover:border-line-2"
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
                  </div>

                  {/* Künye */}
                  <div className="p-6 sm:p-8">
                    <div className="eyebrow">{ac.role}</div>
                    <h2 className="display-tight mt-2 text-3xl text-ink sm:text-4xl">
                      {ac.name}
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-ink-2">
                      {ac.desc}
                    </p>
                  </div>
                </div>

                {/* Alt bölüm: teknik tablo ve hava aracına özgü bilgiler */}
                {(ac.features || ac.specs) && (
                  <div className="border-t border-line bg-bg-2/30 p-6 sm:p-8">
                    {ac.specs && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-line text-ink-3">
                              <th scope="col" className="py-3 pr-5 font-semibold">
                                {t(S.filo.specOzellik)}
                              </th>
                              <th scope="col" className="py-3 font-semibold">
                                {t(S.filo.specDeger)}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ac.specs.map((spec) => (
                              <tr key={spec.label} className="border-b border-line/60 last:border-0">
                                <th
                                  scope="row"
                                  className="py-3 pr-5 font-medium text-ink-2"
                                >
                                  {spec.label}
                                </th>
                                <td className="py-3 text-ink">{spec.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {ac.features && (
                      <ul
                        className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${
                          ac.specs ? "mt-8 border-t border-line/50 pt-8" : ""
                        }`}
                      >
                        {ac.features.map((feature) => (
                          <li key={feature.t}>
                            <span className="text-[13.5px] font-bold text-ink">
                              {feature.t}
                            </span>
                            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-3">
                              {feature.d}
                            </span>
                          </li>
                        ))}
                      </ul>
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
