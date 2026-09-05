import Image from "next/image";
import { DEPARTMENTS, TEAM, ADVISORS } from "@/lib/constants";
import { teamPhotos } from "@/lib/public-assets";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export function DepartmentsSection() {
  const photos = teamPhotos();

  return (
    <section id="departmanlar" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <SectionHeading
        num="03"
        title="Ekip"
        kicker="Altı alt ekip, tek uçak"
      />

      {/* Takım profili */}
      <Reveal>
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {[
            { n: TEAM.memberCount, l: "Aktif Üye" },
            { n: TEAM.branchCount, l: "Mühendislik Branşı" },
            { n: TEAM.alumniCount, l: "Sektörde Mezun" },
            { n: TEAM.founded, l: "Kuruluş" },
          ].map((s) => (
            <div key={s.l} className="bg-bg-1 px-5 py-7 text-center">
              <div className="display tabular text-3xl text-accent">{s.n}</div>
              <div className="eyebrow mt-1.5 !text-[9.5px]">{s.l}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-3">
          Mezunlarımız bugün TUSAŞ, BAYKAR ve ASELSAN gibi sektör liderlerinde
          kilit roller üstleniyor.
        </p>
      </Reveal>

      {/* Ekip fotoğrafları — public/images/team/takim1.jpg, takim2.jpg … */}
      {photos.length > 0 && (
        <Reveal>
          <div
            className={`mt-6 grid gap-4 ${
              photos.length === 1 ? "" : "sm:grid-cols-2"
            }`}
          >
            {photos.slice(0, 2).map((src, i) => (
              <div
                key={src}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-bg-2"
              >
                <Image
                  src={src}
                  alt={`Anatolia Aero Design ekibi ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </Reveal>
      )}

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((d, i) => (
          <Reveal key={d.key} delay={(i % 3) * 70}>
            <article className="group flex h-full flex-col bg-bg p-7 transition-colors hover:bg-bg-1">
              <div className="flex items-start justify-end">
                <span lang="en" className="eyebrow !text-[9.5px]">{d.short}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-ink">{d.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d.desc}</p>
              <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-3">
                {d.detail}
              </p>
            </article>
          </Reveal>
        ))}
      </div>

      {/* Danışmanlar */}
      <Reveal>
        <div className="mt-10 rounded-2xl border border-line bg-bg-1 p-7">
          <div className="eyebrow mb-4">Akademik danışmanlarımız</div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {ADVISORS.map((a) => (
              <li key={a.name}>
                <div className="text-sm font-bold text-ink">{a.name}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-3">{a.role}</div>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
