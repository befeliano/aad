import type { Metadata } from "next";
import { GaleriBaslik } from "@/components/marketing/GaleriBaslik";
import { GaleriClient } from "@/components/marketing/GaleriClient";
import { galleryPhotos } from "@/lib/public-assets";

export const metadata: Metadata = {
  title: "Galeri",
  description:
    "Anatolia Aero Design takımından fotoğraflar, test uçuşları ve yarışma anları.",
};

export default function GaleriPage() {
  const local = galleryPhotos();

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
        <GaleriBaslik />

        <div className="mt-14">
          <GaleriClient local={local} />
        </div>
      </div>
    </section>
  );
}
