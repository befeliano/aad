import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { ParcalarClient } from "@/components/panel/parcalar/ParcalarClient";

export const metadata = { title: "Parçalar (3D)" };

/** Görüntüleme herkese açık; yükleme/silme teknik departmanlara */
const WRITE_DEPTS = ["yazilim", "yapisal", "kompozit", "aviyonik"];

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/parcalar");

  const canWrite = canAccess(session, { allowedDepts: WRITE_DEPTS });
  return <ParcalarClient userId={session.userId} canWrite={canWrite} />;
}
