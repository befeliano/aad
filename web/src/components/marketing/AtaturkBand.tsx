import { Reveal } from "@/components/ui/Reveal";
import { AtaturkSignature, TurkishFlag } from "@/components/ui/TurkishMarks";

/**
 * Atatürk'ün havacılık sözü ve imzası.
 * Takımın milli teknoloji vurgusunu taşıyan sessiz, ağırbaşlı bir bant.
 */
export function AtaturkBand() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-bg">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, var(--hero-glow), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <Reveal>
          <TurkishFlag className="mx-auto h-8 w-12 rounded-[3px] shadow-[var(--shadow-sm)]" />

          <blockquote className="display-tight mt-8 text-3xl leading-tight text-ink sm:text-5xl">
            “İstikbal göklerdedir.”
          </blockquote>

          <div className="mt-8 flex flex-col items-center gap-2">
            <AtaturkSignature className="h-14 w-auto text-ink-2 opacity-80 sm:h-16" />
            <span className="eyebrow !text-[10px]">
              Mustafa Kemal Atatürk
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
