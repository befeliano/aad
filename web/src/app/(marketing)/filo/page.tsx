import type { Metadata } from "next";
import { FiloBaslik } from "@/components/marketing/FiloBaslik";
import { FiloListesi } from "@/components/marketing/FiloListesi";
import { FLEET } from "@/lib/constants";
import { fleetImage } from "@/lib/public-assets";

export const metadata: Metadata = {
  title: "Filo",
  description:
    "Anatolia Aero Design'ın 2011'den bugüne tasarlayıp ürettiği insansız hava araçları: DABAN, GÖLGE, MERLIN, JAEGER, DORJE ve HYDRA.",
};

export default function FiloPage() {
  /* Görseller dosya sisteminden: sunucuda okunup listeye prop olarak geçilir */
  const images = Object.fromEntries(
    FLEET.map((ac) => [ac.slug, fleetImage(ac.slug)])
  );

  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <FiloBaslik />

      <div className="mt-14">
        <FiloListesi images={images} />
      </div>
    </section>
  );
}
