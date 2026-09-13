import type { Metadata } from "next";
import { IletisimIcerik } from "@/components/marketing/IletisimIcerik";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "Anatolia Aero Design ile iletişime geçin — sponsorluk, iş birliği ve sorularınız için.",
};

export default function IletisimPage() {
  return <IletisimIcerik />;
}
