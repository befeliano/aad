"use client";

import { S, useT } from "@/lib/i18n";

/**
 * "Gökyüzü bizim alanımız" bandı.
 * Uçaklar artık bu bölüme hapsedilmiyor — PageAircraft bileşeni onları
 * sayfanın tamamında, scroll'a kilitli olarak uçuruyor.
 */
export function ScrollParallax() {
  const t = useT();

  return (
    <section
      className="relative min-h-[70vh] overflow-hidden border-t border-line bg-bg-1 py-24"
    >
      {/* Zemin dokusu ve ışık */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 30%, var(--hero-glow), transparent 65%)",
        }}
      />

      {/* Metin */}
      <div className="relative z-[1] mx-auto max-w-3xl px-5 pt-[6vh] text-center sm:px-8">
        <div className="eyebrow mb-5">{t(S.serit.kicker)}</div>
        <h2 className="display-tight text-4xl text-ink sm:text-6xl">
          {t(S.serit.baslik1)}{" "}
          <span className="text-accent">{t(S.serit.baslik2)}</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2">
          {t(S.serit.metin)}
        </p>
      </div>
    </section>
  );
}
