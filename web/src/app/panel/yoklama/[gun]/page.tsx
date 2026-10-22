import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { YoklamaAlClient } from "@/components/panel/yoklama/YoklamaAlClient";

export const metadata = { title: "Yoklama" };

/** /panel/yoklama/2026-10-24 — o günün yoklaması (tam sayfa) */
export default async function Page({
  params,
}: {
  params: Promise<{ gun: string }>;
}) {
  const { gun } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gun) || Number.isNaN(Date.parse(gun))) notFound();

  const session = await getSession();
  if (!session) redirect(`/giris?next=/panel/yoklama/${gun}`);

  return (
    <YoklamaAlClient
      gun={gun}
      userId={session.userId}
      isAdmin={session.isAdmin}
      role={session.role}
      myDept={session.dept}
    />
  );
}
