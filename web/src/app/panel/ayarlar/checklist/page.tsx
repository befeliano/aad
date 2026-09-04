import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChecklistAyarlari } from "@/components/panel/ayarlar/ChecklistAyarlari";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Kontrol Listesi Ayarları" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ayarlar/checklist");
  // Şablonu yalnızca kaptan düzenler (RLS de aynı kuralı uyguluyor)
  if (!session.isAdmin) {
    return <AccessDenied title="Kontrol Listesi Ayarları" adminOnly />;
  }
  return <ChecklistAyarlari />;
}
