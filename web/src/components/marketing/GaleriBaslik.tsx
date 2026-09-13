"use client";

import { Reveal } from "@/components/ui/Reveal";
import { S, useT } from "@/lib/i18n";

/** /galeri sayfa başlığı */
export function GaleriBaslik() {
  const t = useT();

  return (
    <Reveal>
      <div className="eyebrow mb-4">{t(S.galeri.eyebrow)}</div>
      <h1 className="display-tight text-5xl text-ink sm:text-7xl">
        {t(S.galeri.baslik)}
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
        {t(S.galeri.lead)}
      </p>
    </Reveal>
  );
}
