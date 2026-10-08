import type { Metadata } from "next";
import { KatilIcerik } from "@/components/marketing/KatilIcerik";

export const metadata: Metadata = {
  title: "Takıma Katıl",
  description:
    "Anatolia Aero Design ekibine katılmak için başvuru formunu doldurabilirsiniz. Yazılım, tasarım, kompozit, aviyonik, yapısal ve medya ekiplerine başvurular alınmaktadır.",
};

export default function KatilPage() {
  return <KatilIcerik />;
}
