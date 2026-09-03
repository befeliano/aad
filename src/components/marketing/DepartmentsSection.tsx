import { DEPARTMENTS } from "@/lib/constants";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export function DepartmentsSection() {
  return (
    <section id="departmanlar" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <SectionHeading
        num="03"
        title="Ekip"
        kicker="Altı disiplin, tek uçak"
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((d, i) => (
          <Reveal key={d.key} delay={(i % 3) * 70}>
            <article className="group flex h-full flex-col bg-bg p-7 transition-colors hover:bg-bg-1">
              <div className="flex items-start justify-between">
                <span className="display tabular text-2xl text-ink-3 transition-colors group-hover:text-accent">
                  {d.num}
                </span>
                <span className="eyebrow !text-[9.5px]">{d.short}</span>
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
    </section>
  );
}
