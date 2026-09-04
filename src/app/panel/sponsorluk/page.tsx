import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { SponsorlukClient } from "@/components/panel/sponsorluk/SponsorlukClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Bütçe & Sponsor" };

const ALLOWED = ["sponsorluk"];

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/sponsorluk");
  if (!canAccess(session, { allowedDepts: ALLOWED })) {
    return <AccessDenied title="Bütçe & Sponsor" allowed={ALLOWED} />;
  }
  return <SponsorlukClient userId={session.userId} />;
}
