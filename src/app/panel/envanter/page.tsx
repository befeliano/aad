import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { EnvanterClient } from "@/components/panel/envanter/EnvanterClient";

export const metadata = { title: "Envanter" };

export default async function EnvanterPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/envanter");

  return <EnvanterClient userId={session.userId} />;
}
