import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GorevlerClient } from "@/components/panel/gorevler/GorevlerClient";

export const metadata = { title: "Görevler" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/gorevler");

  const myName =
    session.profile?.full_name ||
    session.profile?.username ||
    session.email?.split("@")[0] ||
    "";

  return <GorevlerClient userId={session.userId} myName={myName} />;
}
