import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UcuslarClient } from "@/components/panel/ucuslar/UcuslarClient";

export const metadata = { title: "Uçuş Kayıtları" };

export default async function UcuslarPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ucuslar");

  return <UcuslarClient userId={session.userId} />;
}
