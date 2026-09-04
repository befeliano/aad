import Image from "next/image";
import { FLEET, FLEET_ARCHIVE } from "@/lib/constants";
import { fleetImage } from "@/lib/public-assets";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export function FleetSection() {
  return (
    <section id="filo" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <SectionHeading
        num="01"
        title="Filo"
        kicker="2011'den bugüne tasarlayıp ürettiğimiz platformlar"
      />

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FLEET.map((ac, i) => {
          const img = fleetImage(ac.slug);
          return (
          <Reveal
            key={ac.name}
            delay={i * 80}
            className={ac.flagship ? "md:col-span-2 lg:col-span-3" : ""}
          >
            <article
              className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-bg-1 p-6 transition-all hover:border-line-2 hover:shadow-[var(--shadow)] sm:p-7 ${
                ac.flagship
                  ? "border-accent/40 lg:flex-row lg:items-center lg:gap-10"
                  : ""
              }`}
            >
              {/* Görsel alanı — gerçek uçak fotoğrafı buraya */}
              <div
                className={`relative mb-6 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl border border-line bg-bg-2 ${
                  ac.flagship ? "lg:mb-0 lg:w-[55%]" : ""
                }`}
              >
                {img ? (
                  <Image
                    src={img}
                    alt={`${ac.name} insansız hava aracı`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 560px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <>
                    {/* public/images/fleet/<slug>.jpg eklenince otomatik kullanılır */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(circle at 62% 32%, var(--accent-soft), transparent 62%)",
                      }}
                    />
                    <div className="grid-texture absolute inset-0" />
                    <PlaneMark className="w-[62%] text-ink opacity-[0.10] transition-transform duration-700 group-hover:scale-105" />
                  </>
                )}
                <span
                  className={`eyebrow absolute left-4 top-3.5 !text-[10px] ${
                    img
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

              <div className={ac.flagship ? "lg:w-[45%]" : ""}>
                <div className="eyebrow">{ac.role}</div>
                <h3
                  className={`display-tight mt-2.5 text-ink ${
                    ac.flagship ? "text-5xl sm:text-7xl" : "text-3xl sm:text-4xl"
                  }`}
                >
                  {ac.name}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">
                  {ac.desc}
                </p>

                {ac.features && (
                  <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
                    {ac.features.map((f) => (
                      <li key={f.t}>
                        <span className="text-[13.5px] font-bold text-ink">
                          {f.t}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">
                          {f.d}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
                  {ac.specs.map((s) => (
                    <div key={s.label} className="bg-bg-1 px-3 py-3">
                      <dt className="eyebrow !text-[9.5px]">{s.label}</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
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

function PlaneMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true">
      <path
        d="M100 30 L140 60 L160 70 L160 75 L140 70 L120 75 L120 90 L130 95 L130 98 L100 95 L70 98 L70 95 L80 90 L80 75 L60 70 L40 75 L40 70 L60 60 Z"
        fill="currentColor"
      />
    </svg>
  );
}
