"use client";

import { ArrowUpRight } from "lucide-react";
import { BASVURU_FORMU, TEAM, TAKIM_ISTATISTIK } from "@/lib/constants";
import { useDepartments } from "@/lib/content";
import { S, useT } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Gömülü Google Forms başvuru sayfası.
 *
 * Form Google tarafında barındırılıyor; cevaplar takımın form
 * hesabına düşüyor. Gömme için `?embedded=true` gerekiyor — Google
 * bu parametre olmadan kendi başlık ve altbilgisini de basıyor.
 *
 * iframe engellenirse (tarayıcı ayarı, kurumsal ağ) altındaki bağlantı
 * formu yeni sekmede açar; kimse başvuramadan kalmaz.
 */
const GOMULU_FORM = `${BASVURU_FORMU}?embedded=true`;

export function KatilIcerik() {
  const t = useT();
  const departments = useDepartments();

  return (
    <>
      {/* Başlık */}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">{t(S.katil.eyebrow)}</div>
          <h1 className="display-tight text-4xl text-ink sm:text-6xl">
            {t(S.katil.baslik1)}
            <br />
            <span className="text-accent">{t(S.katil.baslik2)}</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-ink-2">
            {t(S.katil.p1a)} {TAKIM_ISTATISTIK.sampiyonluk} {t(S.katil.p1b)}
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            {t(S.katil.p2)}
          </p>
        </div>

        {/* Alt ekipler */}
        <Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <div key={d.key} className="bg-bg-1 p-6">
                {d.short && (
                  <span lang="en" className="eyebrow !text-[9.5px]">
                    {d.short}
                  </span>
                )}
                <h2 className="mt-2 text-[17px] font-bold text-ink">{d.name}</h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                  {d.desc}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Form */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="display-tight text-2xl text-ink sm:text-3xl">
                {t(S.katil.formBaslik)}
              </h2>
              <p className="mt-2 text-sm text-ink-2">{t(S.katil.formAlt)}</p>
            </div>
            <a
              href={BASVURU_FORMU}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-4 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
            >
              {t(S.katil.yeniSekme)}
              <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-bg">
            <iframe
              src={GOMULU_FORM}
              title={`${TEAM.name} — ${t(S.katil.formBaslik)}`}
              className="h-[1100px] w-full"
              loading="lazy"
            >
              {t(S.katil.yukleniyor)}
            </iframe>
          </div>

          <p className="mt-4 text-center text-[12.5px] text-ink-3">
            {t(S.katil.gorunmuyor1)}{" "}
            <a
              href={BASVURU_FORMU}
              target="_blank"
              rel="noopener"
              className="text-accent underline underline-offset-2"
            >
              {t(S.katil.baglanti)}
            </a>{" "}
            {t(S.katil.gorunmuyor2)}
          </p>
        </div>
      </section>
    </>
  );
}
