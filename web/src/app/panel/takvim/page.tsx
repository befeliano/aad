import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TakvimClient } from "@/components/panel/takvim/TakvimClient";

export const metadata = { title: "Çalışma Takvimi" };

/** Takvimi herkes görür; kaptan, yardımcısı ve birim kaptanları düzenler. */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/takvim");

  return (
    <TakvimClient
      canWrite={session.isAdmin || session.role === "captain"}
      userId={session.userId}
      isAdmin={session.isAdmin}
      role={session.role}
      myDept={session.dept}
    />
  );
}
