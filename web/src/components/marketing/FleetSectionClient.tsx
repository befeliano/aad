"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FLEET_ARCHIVE } from "@/lib/constants";
import { useFleet } from "@/lib/content";
import { S, useT } from "@/lib/i18n";
import { AircraftSprite } from "./AircraftSprite";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

/**
 * Ana sayfadaki filo bölümünün metin gövdesi.
 *
 * Görsel yolları sunucuda (FleetSection) dosya sisteminden okunup
 * prop olarak geliyor; burada yalnızca dile bağlı içerik var.
 */
export function FleetSectionClient({
  images,
}: {
  images: Record<string, string | null>;
}) {
  const t = useT();
  const fleet = useFleet();

  return (
    <section
      id="filo"
      className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28"
    >
      <SectionHeading
        num="01"
        title={t(S.filo.baslik)}
        kicker={t(S.filo.kicker)}
      />

      {/* Filoyu tanımlayan metin */}
      <Reveal>
        <div className="mt-10 max-w-3xl rounded-2xl border border-line bg-bg-1 p-7 sm:p-8">
          <p className="text-[15px] leading-relaxed text-ink-2">
            {t(S.filo.tanim1)}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {t(S.filo.tanim2)}
          </p>
          <Link
            href="/filo"
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            {t(S.filo.tumFilo)}
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </Reveal>

      {/* Kısa künyeler — kutu yok, yalnızca metin */}
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {fleet.map((ac, i) => {
          const img = images[ac.slug] ?? null;
          const alt = `${ac.name} ${t(S.filo.ihaAlt)}`;
          return (
            <Reveal key={ac.name} delay={Math.min(i, 3) * 70}>
              <Link
                href="/filo"
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-bg-1 transition-all hover:border-line-2 hover:shadow-[var(--shadow)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-bg-2">
                  {img ? (
                    <Image
                      src={img}
                      alt={alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : ac.sprite ? (
                    <AircraftSprite
                      box={ac.sprite}
                      alt={alt}
                      className="size-full transition-transform duration-700 group-hover:scale-105"
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

                <div className="flex flex-1 flex-col p-6">
                  <div className="eyebrow !text-[9.5px]">{ac.role}</div>
                  <h3 className="display-tight mt-2 text-2xl text-ink sm:text-3xl">
                    {ac.name}
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
                    {ac.desc}
                  </p>
                </div>
              </Link>
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
    </section>
  );
}
