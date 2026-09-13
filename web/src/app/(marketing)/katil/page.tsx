import type { Metadata } from "next";
import { KatilIcerik } from "@/components/marketing/KatilIcerik";

export const metadata: Metadata = {
  title: "Takıma Katıl",
  description:
    "Anatolia Aero Design'a katılmak için başvuru formunu doldurun. Yazılım, tasarım, kompozit, aviyonik, yapısal ve medya ekiplerine alım yapıyoruz.",
};

export default function KatilPage() {
  return <KatilIcerik />;
}
