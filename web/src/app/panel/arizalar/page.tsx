import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ArizalarClient } from "@/components/panel/arizalar/ArizalarClient";

export const metadata = { title: "Arıza Günlüğü" };

/** Arızayı herkes bildirebilir — sorunu gören kişi yazamıyorsa kayıt tutulmaz. */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/arizalar");

  return (
    <ArizalarClient
      userId={session.userId}
      isAdmin={session.isAdmin}
      myDept={session.dept}
      role={session.role}
    />
  );
}
