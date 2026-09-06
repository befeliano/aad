import Image from "next/image";
import { FLEET, FLEET_ARCHIVE } from "@/lib/constants";
import { AircraftSprite } from "./AircraftSprite";
import { fleetImage } from "@/lib/public-assets";
import { Reveal } from "@/components/ui/Reveal";

/**
 * /filo sayfasının gövdesi.
 *
 * Ana sayfadaki bölümün aksine burada her platform TAM GENİŞLİK ve alt alta:
 * görsel solda, künye sağda, teknik değerler kutularıyla birlikte. Ana
 * sayfada kutular yok — orada yalnızca ad ve kısa tanım var.
 */
export function FiloListesi() {
  return (
    <>
      <div className="space-y-8">
        {FLEET.map((ac, i) => {
          const img = fleetImage(ac.slug);
          return (
            <Reveal key={ac.name} delay={Math.min(i, 3) * 70}>
              <article
                className={`overflow-hidden rounded-2xl border bg-bg-1 transition-colors hover:border-line-2 ${
                  ac.flagship ? "border-accent/40" : "border-line"
                }`}
              >
                <div className="grid gap-0 lg:grid-cols-[minmax(0,52%)_minmax(0,48%)]">
                  {/* Görsel */}
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-bg-2 lg:border-b-0 lg:border-r">
                    {img ? (
                      <Image
                        src={img}
                        alt={`${ac.name} insansız hava aracı`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 620px"
                        className="object-cover"
                      />
                    ) : ac.sprite ? (
                      <AircraftSprite
                        box={ac.sprite}
                        alt={`${ac.name} insansız hava aracı`}
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
                        Amiral Gemisi
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

                    {ac.features && (
                      <ul className="mt-6 space-y-3 border-t border-line pt-5">
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
    </>
  );
}
