import type { Metadata } from "next";
import { SponsorlukIcerik } from "@/components/marketing/SponsorlukIcerik";

export const metadata: Metadata = {
  title: "Sponsorluk",
  description:
    "Anatolia Aero Design sponsorluk seviyeleri — First Class, Business Class ve Economy Class. Uçak gövdesinden takım kıyafetlerine marka görünürlüğü, ürün test ve raporlama imkânı.",
};

export default function SponsorlukPage() {
  return <SponsorlukIcerik />;
}
