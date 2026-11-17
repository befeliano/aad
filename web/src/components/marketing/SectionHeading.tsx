import { Reveal } from "@/components/ui/Reveal";

export function SectionHeading({
  num,
  title,
  kicker,
}: {
  num: string;
  title: string;
  kicker?: string;
}) {
  return (
    <Reveal>
      <div className="flex items-end justify-between gap-3 border-b border-line pb-6 sm:gap-6">
        <div className="min-w-0">
          {kicker && <div className="eyebrow mb-3">{kicker}</div>}
          <h2 className="display-tight text-[clamp(2rem,9vw,2.5rem)] leading-tight text-ink sm:text-6xl">
            {title}
          </h2>
        </div>
        <span className="display tabular shrink-0 text-2xl text-accent sm:text-5xl">
          {num}
        </span>
      </div>
    </Reveal>
  );
}
