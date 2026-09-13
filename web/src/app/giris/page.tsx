import type { Metadata } from "next";
import { GirisKabuk } from "@/components/auth/GirisKabuk";

export const metadata: Metadata = {
  title: "Takım Girişi",
  robots: { index: false },
};

export default function GirisPage() {
  return <GirisKabuk />;
}
