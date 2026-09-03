import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { NotlarClient } from "@/components/panel/notlar/NotlarClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Uçuş Notları" };

/** Uçuş notları teknik departmanlara açıktır */
const ALLOWED = ["yazilim", "yapisal", "kompozit", "aviyonik"];

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/notlar");
  if (!canAccess(session, { allowedDepts: ALLOWED })) {
    return <AccessDenied title="Uçuş Notları" allowed={ALLOWED} />;
  }
  return <NotlarClient userId={session.userId} />;
}
