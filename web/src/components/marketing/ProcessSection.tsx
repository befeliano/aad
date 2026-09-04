import { PROCESS_STEPS } from "@/lib/constants";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export function ProcessSection() {
  return (
    <section
      id="surec"
      className="relative border-t border-line bg-bg-1"
    >
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
        <SectionHeading num="04" title="Süreç" kicker="Fikirden uçuşa" />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="group h-full rounded-2xl border border-line bg-bg p-7 transition-all hover:border-accent/35 hover:shadow-[var(--shadow-sm)]">
                <div className="display tabular text-5xl text-bg-3 transition-colors group-hover:text-accent">
                  {s.n}
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink">{s.t}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
                  {s.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
