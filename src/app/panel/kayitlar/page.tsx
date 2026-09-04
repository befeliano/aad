import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { KayitlarClient } from "@/components/panel/kayitlar/KayitlarClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "İşlem Kayıtları" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/kayitlar");
  if (!session.isAdmin) {
    return <AccessDenied title="İşlem Kayıtları" adminOnly />;
  }
  return <KayitlarClient />;
}
