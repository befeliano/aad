import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UyelerClient } from "@/components/panel/uyeler/UyelerClient";
import { AccessDenied } from "@/components/panel/AccessDenied";
import { ROL_ATAYABILEN } from "@/lib/constants";

export const metadata = { title: "Üye Yönetimi" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/uyeler");
  // Rol ve birim atama yalnızca takım kaptanında (ve teknik yönetici
  // hesabında). Aynı kural DB'de: yetki-duzeltmeleri-3.sql
  if (!(ROL_ATAYABILEN as readonly string[]).includes(session.role)) {
    return (
      <AccessDenied
        title="Üye Yönetimi"
        mesaj="Üye Yönetimi yalnızca takım kaptanına açıktır."
      />
    );
  }
  return <UyelerClient myId={session.userId} />;
}
