import type { Metadata } from "next";
import { GaleriClient } from "@/components/marketing/GaleriClient";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Galeri",
  description:
    "Anatolia Aero Design takımından fotoğraflar, test uçuşları ve yarışma anları.",
};

export default function GaleriPage() {
  return (
    <section className="relative pt-28">
      <div
        className="absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% -20%, var(--hero-glow), transparent 62%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal>
          <div className="eyebrow mb-4">Galeri</div>
          <h1 className="display-tight text-5xl text-ink sm:text-7xl">
            Sahadan kareler.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
            Test uçuşları, atölye çalışmaları ve yarışma anları. Takımın
            hikâyesi burada.
          </p>
        </Reveal>

        <div className="mt-14">
          <GaleriClient />
        </div>
      </div>
    </section>
  );
}
