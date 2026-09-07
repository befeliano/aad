import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MulakatClient } from "@/components/panel/mulakat/MulakatClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Mülakat Değerlendirme" };

/**
 * Mülakat kayıtlarını takım kaptanı, yardımcısı ve birim kaptanları görür.
 *
 * Bilerek dar: burada aday adı, yaşı, iletişim bilgisi ve değerlendirme
 * notu var. Aynı kural RLS'te de uygulanıyor (supabase/mulakat.sql);
 * buradaki kontrol yalnızca boş ekran yerine açıklama göstermek için.
 */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/mulakat");

  const yetkili = session.isAdmin || session.role === "captain";
  if (!yetkili) {
    return <AccessDenied title="Mülakat Değerlendirme" />;
  }

  return (
    <MulakatClient
      userId={session.userId}
      isAdmin={session.isAdmin}
      myDept={session.dept}
    />
  );
}
