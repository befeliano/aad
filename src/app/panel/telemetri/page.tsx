import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { TelemetriClient } from "@/components/panel/telemetri/TelemetriClient";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "API & Telemetri" };

const ALLOWED = ["yazilim", "aviyonik"];

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/telemetri");
  if (!canAccess(session, { allowedDepts: ALLOWED })) {
    return <AccessDenied title="API & Telemetri" allowed={ALLOWED} />;
  }
  return <TelemetriClient userId={session.userId} />;
}
