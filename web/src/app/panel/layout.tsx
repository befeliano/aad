import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { PANEL_NAV } from "@/lib/panel-nav";
import { PanelShell } from "@/components/panel/PanelShell";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel");

  // Erişilebilir nav'ı sunucuda hesapla, client'a serileştir
  const nav = PANEL_NAV.map((group) => ({
    title: group.title,
    items: group.items.filter((it) =>
      canAccess(session, {
        allowedDepts: it.allowedDepts,
        adminOnly: it.adminOnly,
      })
    ),
  })).filter((g) => g.items.length > 0);

  const displayName =
    session.profile?.full_name ||
    session.profile?.username ||
    session.email?.split("@")[0] ||
    "Üye";

  return (
    <PanelShell
      nav={nav}
      user={{
        name: displayName,
        dept: session.dept,
        isAdmin: session.isAdmin,
        role: session.role,
      }}
    >
      {children}
    </PanelShell>
  );
}
