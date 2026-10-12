"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { S, useT } from "@/lib/i18n";

export function SponsorCTA() {
  const t = useT();

  return (
    <section className="relative overflow-hidden border-t border-line">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 110% at 50% 100%, var(--hero-glow), transparent 62%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-5 py-28 text-center sm:px-8">
        <Reveal>
          <div className="eyebrow mb-5">{t(S.cta.kicker)}</div>
          <h2 className="display-tight text-4xl text-ink sm:text-6xl">
            {t(S.cta.baslik1)}
            <br />
            <span className="text-accent">{t(S.cta.baslik2)}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2">
            {t(S.cta.metin)}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/sponsorluk"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition-transform hover:scale-[1.03]"
            >
              {t(S.cta.sponsorOl)}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="/iletisim"
              className="rounded-full border border-line-2 px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink-3"
            >
              {t(S.cta.iletisim)}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
