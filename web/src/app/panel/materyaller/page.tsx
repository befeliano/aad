import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MedyaClient } from "@/components/panel/medya/MedyaClient";

export const metadata = { title: "Medya & Materyaller" };

export default async function MateryallerPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/materyaller");

  return <MedyaClient userId={session.userId} />;
}
