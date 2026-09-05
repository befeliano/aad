import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ProfilAyarlari } from "@/components/panel/ayarlar/ProfilAyarlari";

export const metadata = { title: "Profilim" };

/** Her üye kendi profilini düzenleyebilir — yetki kontrolü yok, sadece oturum. */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ayarlar/profil");

  return <ProfilAyarlari userId={session.userId} email={session.email} />;
}
