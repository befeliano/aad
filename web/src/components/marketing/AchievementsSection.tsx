import { Trophy } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/constants";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export function AchievementsSection() {
  return (
    <section
      id="basarilar"
      className="relative border-t border-line bg-bg-1"
    >
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
        <SectionHeading
          num="02"
          title="Başarılar"
          kicker="2013'ten bugüne ulusal ve uluslararası derecelerimiz"
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {ACHIEVEMENTS.map((a, i) => (
            <Reveal key={a.year + a.title} delay={i * 70}>
              <article
                className={`group relative flex h-full items-start gap-5 overflow-hidden rounded-2xl border p-7 transition-colors ${
                  a.highlight
                    ? "border-accent/35 bg-[linear-gradient(135deg,var(--accent-soft),transparent_60%)]"
                    : "border-line bg-bg hover:border-line-2"
                }`}
              >
                <div
                  className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${
                    a.highlight
                      ? "bg-accent text-white"
                      : "bg-bg-2 text-ink-2"
                  }`}
                >
                  {a.rank === "1." ? (
                    <span className="display text-2xl leading-none">1.</span>
                  ) : (
                    <Trophy size={22} />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="display tabular text-lg text-accent">
                      {a.year}
                    </span>
                    <span className="rounded-full bg-bg-2 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                      {a.scope === "uluslararasi" ? "Uluslararası" : "Ulusal"}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold leading-snug text-ink">
                    {a.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                    {a.detail}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
