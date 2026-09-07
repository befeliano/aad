import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { MesajlarClient } from "@/components/panel/mesajlar/MesajlarClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Gelen Kutusu" };

/**
 * Siteden gelen iletişim mesajları.
 * Medya & Sponsorluk ekibinin tamamı + takım kaptanı ve yardımcısı.
 * Aynı kural RLS'te de var (supabase/gelen-kutusu.sql).
 */
const ALLOWED = ["sponsorluk"];

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/mesajlar");
  if (!canAccess(session, { allowedDepts: ALLOWED })) {
    return <AccessDenied title="Gelen Kutusu" allowed={ALLOWED} />;
  }

  return <MesajlarClient isAdmin={session.isAdmin} />;
}
