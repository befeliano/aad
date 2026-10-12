import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ToplantiClient } from "@/components/panel/toplanti/ToplantiClient";

export const metadata = { title: "Toplantı Odası" };

/** Toplantıya tüm takım katılabilir — yetki kontrolü yok, sadece oturum. */
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/toplanti");

  const displayName =
    session.profile?.full_name?.trim() ||
    session.email?.split("@")[0] ||
    "Üye";

  return (
    <ToplantiClient
      userId={session.userId}
      displayName={displayName}
      isAdmin={session.isAdmin}
    />
  );
}
