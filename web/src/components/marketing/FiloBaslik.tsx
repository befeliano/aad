"use client";

import { S, useT } from "@/lib/i18n";

/** /filo sayfa başlığı — dile bağlı olduğu için ayrı istemci bileşeni */
export function FiloBaslik() {
  const t = useT();

  return (
    <header className="max-w-3xl">
      <div className="eyebrow mb-4">{t(S.filo.baslik)}</div>
      <h1 className="display-tight text-4xl text-ink sm:text-6xl">
        {t(S.filo.sayfaBaslik1)}
        <br />
        <span className="text-accent">{t(S.filo.sayfaBaslik2)}</span>
      </h1>
      <p className="mt-6 text-base leading-relaxed text-ink-2">
        {t(S.filo.sayfaLead)}
      </p>
    </header>
  );
}
