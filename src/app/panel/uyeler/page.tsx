import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UyelerClient } from "@/components/panel/uyeler/UyelerClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Üye Yönetimi" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/uyeler");
  if (!session.isAdmin) {
    return <AccessDenied title="Üye Yönetimi" adminOnly />;
  }
  return <UyelerClient myId={session.userId} />;
}
