import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { YoklamaKayitlariClient } from "@/components/panel/yoklama/YoklamaKayitlariClient";

export const metadata = { title: "Yoklama Kayıtları" };

/**
 * Herkes açabilir; ne göreceğini RLS belirler (yoklama.sql):
 * tam yetkililer tüm birimleri, birim kaptanı kendi birimini, üye
 * yalnızca kendi kayıtlarını.
 */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/yoklama");
  return <YoklamaKayitlariClient />;
}
