import type { Metadata } from "next";
import { connection } from "next/server";
import { FiloBaslik } from "@/components/marketing/FiloBaslik";
import { FiloListesi } from "@/components/marketing/FiloListesi";
import { FLEET } from "@/lib/constants";
import { fleetImage, versionedPublicUrl } from "@/lib/public-assets";

export const metadata: Metadata = {
  title: "Filo",
  description:
    "Anatolia Aero Design'ın 2011'den bugüne geliştirdiği hava araçları: ANZU, DABAN, GÖLGE MK5, MERLIN, JAEGER, DORJE MK3, HYDRA MK3, BUMBLEBEE, ATLAS, TARDİS, BALERİN, TULPAR, HARPY ve FOTON.",
};

export default async function FiloPage() {
  /* Statik önbellek görsel adresini dondurmasın; ana sayfayla aynı dosya */
  await connection();
  const images = Object.fromEntries(
    FLEET.map((ac) => [ac.slug, versionedPublicUrl(fleetImage(ac.slug))])
  );

  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-[calc(7rem+env(safe-area-inset-top))] sm:px-8 sm:pt-[calc(8rem+env(safe-area-inset-top))]">
      <FiloBaslik />

      <div className="mt-14">
        <FiloListesi images={images} />
      </div>
    </section>
  );
}
