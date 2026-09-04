import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { IhtiyaclarClient } from "@/components/panel/ihtiyaclar/IhtiyaclarClient";

export const metadata = { title: "İhtiyaç Tablosu" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ihtiyaclar");
  return <IhtiyaclarClient userId={session.userId} />;
}
