import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { KayitlarClient } from "@/components/panel/kayitlar/KayitlarClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "İşlem Kayıtları" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/kayitlar");
  /* Yalnızca tam yetkililer (kaptan, yardımcısı, danışmanlar).
     Aynı kural RLS'te: supabase/yetki-duzeltmeleri-3.sql */
  const yetkili = session.isAdmin;
  if (!yetkili) {
    return (
      <AccessDenied
        title="İşlem Kayıtları"
        mesaj="İşlem Kayıtları yalnızca takım kaptanı, yardımcısı ve danışmanlara açıktır."
      />
    );
  }
  return <KayitlarClient />;
}
