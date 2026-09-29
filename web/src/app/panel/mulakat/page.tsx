import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MulakatClient } from "@/components/panel/mulakat/MulakatClient";

export const metadata = { title: "Mülakatlar" };

/**
 * Aday listesi. Panele giren herkes görür, aday ekler ve not düzenler —
 * rol kısıtı şimdilik bilerek yok, ileride eklenebilir. Aynı kural RLS'te:
 * supabase/mulakat-form.sql. Silme yalnızca kaptan, yardımcısı ve adayın
 * birim kaptanında (aday sayfasında).
 *
 * Başvuru formunu dolduran her kişi webhook ile otomatik eklenir
 * (api/mulakat/form).
 */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/mulakat");

  return <MulakatClient userId={session.userId} />;
}
