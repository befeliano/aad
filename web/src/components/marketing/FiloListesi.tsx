"use client";

import Image from "next/image";
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
                    {ac.codename && (
                      <span
                        className={`eyebrow absolute left-4 top-3.5 !text-[10px] ${
                          img || ac.sprite
                            ? "rounded-full bg-black/55 px-2.5 py-1 !text-white backdrop-blur-sm"
                            : ""
                        }`}
                      >
                        {ac.codename}
                      </span>
                    )}
                  </div>

                  {/* Künye */}
                  <div className="p-6 sm:p-8">
                    {ac.role && <div className="eyebrow">{ac.role}</div>}
                    <h2 className="display-tight mt-2 text-3xl text-ink sm:text-4xl">
                      {ac.name}
                    </h2>
                    {ac.desc && (
                      <p className="mt-4 text-sm leading-relaxed text-ink-2">
                        {ac.desc}
                      </p>
                    )}
                    {ac.specs && (
                      <div className="mt-5">
                        <table className="w-full border-collapse text-left text-[12.5px]">
                          <thead>
                            <tr className="border-b border-line text-ink-3">
                              <th scope="col" className="py-1.5 pr-4 font-semibold">
                                {t(S.filo.specOzellik)}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ac.specs.map((spec) => (
                              <tr
                                key={spec.label}
                                className="border-b border-line/60 last:border-0"
                              >
                                <th
                                  scope="row"
                                  className="py-1.5 pr-4 font-medium text-ink-2"
                                >
                                  {spec.label}
                                </th>
                                <td className="py-1.5 text-ink">{spec.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alt bölüm: hava aracına özgü bilgiler */}
                {ac.features && (
                  <div className="border-t border-line bg-bg-2/30 p-6 sm:p-8">
                    <ul className="flex flex-wrap items-start justify-center gap-x-10 gap-y-6 text-center">
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
                  </div>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>

    </>
  );
}
