import type { Metadata } from "next";
import { FiloListesi } from "@/components/marketing/FiloListesi";
import { TEAM, FLEET, FLEET_ARCHIVE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Filo",
  description:
    "Anatolia Aero Design'ın 2011'den bugüne tasarlayıp ürettiği insansız hava araçları: DABAN, GÖLGE, MERLIN, JAEGER, DORJE ve HYDRA.",
};

export default function FiloPage() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <header className="max-w-3xl">
        <div className="eyebrow mb-4">Filo</div>
        <h1 className="display-tight text-4xl text-ink sm:text-6xl">
          {TEAM.founded}&apos;den bugüne
          <br />
          <span className="text-accent">ürettiğimiz platformlar</span>
        </h1>
        <p className="mt-6 text-base leading-relaxed text-ink-2">
          Her platform bir öncekinin mühendislik birikimi üzerine kuruldu.
          Sabit kanat gövdelerden hidrojen yakıt hücresi Ar-Ge&apos;sine kadar
          tasarım, üretim ve uçuş testlerinin tamamı takım içinde yapılıyor.
        </p>
      </header>

      <div className="mt-14">
        <FiloListesi />
      </div>
    </section>
  );
}
