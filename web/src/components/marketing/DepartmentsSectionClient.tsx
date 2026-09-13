"use client";

import Image from "next/image";
import { TEAM } from "@/lib/constants";
import { useAdvisors, useDepartments } from "@/lib/content";
import { S, useT } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

/** Ekip bölümünün gövdesi — fotoğraf yolları sunucudan geliyor. */
export function DepartmentsSectionClient({ photos }: { photos: string[] }) {
  const t = useT();
  const departments = useDepartments();
  const advisors = useAdvisors();

  return (
    <section id="departmanlar" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <SectionHeading
        num="03"
        title={t(S.ekip.baslik)}
        kicker={t(S.ekip.kicker)}
      />

      {/* Takım profili */}
      <Reveal>
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {[
            { n: TEAM.memberCount, l: t(S.ekip.aktifUye) },
            { n: TEAM.branchCount, l: t(S.ekip.brans) },
            { n: TEAM.alumniCount, l: t(S.ekip.mezun) },
            { n: TEAM.founded, l: t(S.ekip.kurulus) },
          ].map((s) => (
            <div key={s.l} className="bg-bg-1 px-5 py-7 text-center">
              <div className="display tabular text-3xl text-accent">{s.n}</div>
              <div className="eyebrow mt-1.5 !text-[9.5px]">{s.l}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-3">
          {t(S.ekip.mezunNot)}
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
                  alt={`${t(S.ekip.fotoAlt)} ${i + 1}`}
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
        {departments.map((d, i) => (
          <Reveal key={d.key} delay={(i % 3) * 70}>
            <article className="group flex h-full flex-col bg-bg p-7 transition-colors hover:bg-bg-1">
              <div className="flex items-start justify-end">
                {/* İngilizcede ad zaten İngilizce; etiket boş bırakılıyor */}
                {d.short && (
                  <span lang="en" className="eyebrow !text-[9.5px]">
                    {d.short}
                  </span>
                )}
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
          <div className="eyebrow mb-4">{t(S.ekip.danismanlar)}</div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {advisors.map((a) => (
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
