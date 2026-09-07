import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UcuslarClient } from "@/components/panel/ucuslar/UcuslarClient";

export const metadata = { title: "Uçuş Kayıtları" };

export default async function UcuslarPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ucuslar");

  /* Uçuş kaydı oluşturma, düzenleme, silme ve uçuş başlatma yalnızca
     birim kaptanları ile kaptan/yardımcıda. Aynı kural RLS'te de var
     (supabase/yetki-duzeltmeleri-2.sql); buradaki kontrol, çalışmayacak
     düğmeleri göstermemek için. */
  const canManage = session.isAdmin || session.role === "captain";

  return <UcuslarClient userId={session.userId} canManage={canManage} />;
}
