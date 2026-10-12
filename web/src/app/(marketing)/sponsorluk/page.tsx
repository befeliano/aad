import type { Metadata } from "next";
import { SponsorlukIcerik } from "@/components/marketing/SponsorlukIcerik";

export const metadata: Metadata = {
  title: "Sponsorluk",
  description:
    "Anatolia Aero Design sponsorluk iletişimi.",
};

export default function SponsorlukPage() {
  // TODO: Sponsorluk katkı seçenekleri netleştiğinde bu sayfaya eklenmeli.
  return <SponsorlukIcerik />;
}
