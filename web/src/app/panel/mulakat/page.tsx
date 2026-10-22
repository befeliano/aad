import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MulakatClient } from "@/components/panel/mulakat/MulakatClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Mülakatlar" };

/**
 * Aday listesi. Tam yetkililer ve birim kaptanları görür, aday ekler ve
 * not düzenler; standart üye erişemez (yetki tablosu, Ekim 2026). Aynı
 * kural RLS'te: supabase/mulakat-yetki.sql. Silme yalnızca tam yetkililer
 * ve adayın birim kaptanında (aday sayfasında).
 *
 * Başvuru formunu dolduran her kişi webhook ile otomatik eklenir
 * (api/mulakat/form).
 */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/mulakat");
  // Tam yetkililer + birim kaptanları. Aynı kural RLS'te: mulakat-yetki.sql
  if (!session.isAdmin && session.role !== "captain") {
    return (
      <AccessDenied
        title="Mülakatlar"
        mesaj="Mülakatlar takım kaptanı, yardımcısı, danışmanlar ve birim kaptanlarına açıktır."
      />
    );
  }

  return <MulakatClient userId={session.userId} />;
}
