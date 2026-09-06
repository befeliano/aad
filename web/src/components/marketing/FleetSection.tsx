import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FLEET, FLEET_ARCHIVE, TEAM } from "@/lib/constants";
import { AircraftSprite } from "./AircraftSprite";
import { fleetImage } from "@/lib/public-assets";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

/**
 * Ana sayfadaki filo bölümü — ÖZET.
 *
 * Teknik değer kutuları bilerek burada değil: yan yana dizilen dört küçük
 * kutu ana sayfada dağınık duruyordu. Ad, görev ve kısa tanım kalıyor;
 * kutular ve ayrıntılı künye /filo sayfasında.
 */
export function FleetSection() {
  return (
    <section
      id="filo"
      className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28"
    >
      <SectionHeading
        num="01"
        title="Filo"
        kicker={`${TEAM.founded}'den bugüne tasarlayıp ürettiğimiz platformlar`}
      />

      {/* Filoyu tanımlayan metin */}
      <Reveal>
        <div className="mt-10 max-w-3xl rounded-2xl border border-line bg-bg-1 p-7 sm:p-8">
          <p className="text-[15px] leading-relaxed text-ink-2">
            Filomuz sabit kanat savaşan İHA&apos;lardan hidrojen yakıt hücresi
            Ar-Ge platformuna kadar uzanıyor. Her uçak bir öncekinin
            birikimiyle tasarlandı: aerodinamik form, kompozit gövde,
            aviyonik entegrasyonu ve otonom uçuş yazılımının tamamı takım
            içinde üretiliyor.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Aşağıda güncel platformların kısa künyesi var. Teknik değerler,
            görev profilleri ve arşivdeki uçaklar için filo sayfasına geçin.
          </p>
          <Link
            href="/filo"
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Tüm filoyu incele
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </Reveal>

      {/* Kısa künyeler — kutu yok, yalnızca metin */}
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FLEET.map((ac, i) => {
          const img = fleetImage(ac.slug);
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
                      alt={`${ac.name} insansız hava aracı`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : ac.sprite ? (
                    <AircraftSprite
                      box={ac.sprite}
                      alt={`${ac.name} insansız hava aracı`}
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
                  {ac.flagship && (
                    <span className="absolute right-4 top-3.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Amiral Gemisi
                    </span>
                  )}
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
          <div className="eyebrow mb-4">Arşiv · geçmiş platformlarımız</div>
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
