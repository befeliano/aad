"use client";

import { useLang, setLang, type Lang } from "@/lib/i18n";

const DILLER: { k: Lang; etiket: string; tam: string }[] = [
  { k: "tr", etiket: "TR", tam: "Türkçe" },
  { k: "en", etiket: "EN", tam: "English" },
];

/**
 * TR / EN değiştirici.
 *
 * Sunucu her zaman Türkçe üretiyor (bkz. i18n.ts getServerSnapshot),
 * bu yüzden ilk boyamada TR seçili görünür; localStorage'da "en" varsa
 * hidrasyondan hemen sonra İngilizceye geçer.
 */
export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang();

  return (
    <div
      role="group"
      aria-label="Dil / Language"
      className={`flex items-center overflow-hidden rounded-full border border-line ${className}`}
    >
      {DILLER.map((d) => {
        const secili = lang === d.k;
        return (
          <button
            key={d.k}
            type="button"
            onClick={() => setLang(d.k)}
            aria-pressed={secili}
            title={d.tam}
            lang="en"
            className={`px-2.5 py-1 text-[11.5px] font-bold tracking-wide transition-colors ${
              secili
                ? "bg-ink text-bg"
                : "text-ink-3 hover:bg-bg-2 hover:text-ink-2"
            }`}
          >
            {d.etiket}
          </button>
        );
      })}
    </div>
  );
}
