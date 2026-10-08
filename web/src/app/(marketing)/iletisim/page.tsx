import type { Metadata } from "next";
import { IletisimIcerik } from "@/components/marketing/IletisimIcerik";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "Anatolia Aero Design ile sponsorluk, iş birliği ve diğer konular için iletişime geçebilirsiniz.",
};

export default function IletisimPage() {
  return <IletisimIcerik />;
}
