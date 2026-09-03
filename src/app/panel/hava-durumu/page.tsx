import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { HavaDurumuClient } from "@/components/panel/hava/HavaDurumuClient";

export const metadata = { title: "Hava Durumu" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/hava-durumu");
  return <HavaDurumuClient />;
}
