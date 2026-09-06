import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TakvimClient } from "@/components/panel/takvim/TakvimClient";

export const metadata = { title: "Çalışma Takvimi" };

/** Takvimi herkes görür; yalnızca kaptan ve yardımcısı düzenler. */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/takvim");

  return <TakvimClient canWrite={session.isAdmin} />;
}
