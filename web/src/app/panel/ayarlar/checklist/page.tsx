import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChecklistAyarlari } from "@/components/panel/ayarlar/ChecklistAyarlari";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Kontrol Listesi Ayarları" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ayarlar/checklist");
  // Şablonu tam yetkililer ve birim kaptanları düzenler
  // (RLS de aynı kuralı uyguluyor: yetki-duzeltmeleri-3.sql)
  if (!session.isAdmin && session.role !== "captain") {
    return (
      <AccessDenied
        title="Kontrol Listesi Ayarları"
        mesaj="Bu sayfa takım kaptanı, yardımcısı, danışmanlar ve birim kaptanlarına açıktır."
      />
    );
  }
  return <ChecklistAyarlari />;
}
