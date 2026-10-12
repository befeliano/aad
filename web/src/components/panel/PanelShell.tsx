"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_LABELS, ROLE_LABELS } from "@/lib/constants";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";
import { BildirimZili } from "./BildirimZili";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

export function PanelShell({
  nav,
  user,
  children,
}: {
  nav: NavGroup[];
  user: { id: string; name: string; dept: string; isAdmin: boolean; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  /* Aktif bağlantı: en uzun eşleşen href kazanır.
     (/panel/ucuslar ile /panel/ucuslar/analiz çakışmasın diye) */
  const activeHref = useMemo(() => {
    const all = nav.flatMap((g) => g.items.map((i) => i.href));
    const matches = all.filter(
      (h) => pathname === h || pathname.startsWith(h + "/")
    );
    return matches.sort((a, b) => b.length - a.length)[0] ?? null;
  }, [nav, pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-line bg-bg-1 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-line px-5">
          <Link href="/" aria-label="Ana sayfa">
            <Logo size={28} />
          </Link>
        </div>

        <nav className="flex h-[calc(100vh-4rem)] flex-col gap-6 overflow-y-auto px-3 py-5">
          {nav.map((group) => (
            <div key={group.title}>
              <div className="eyebrow px-2.5 pb-2">{group.title}</div>
              <ul className="space-y-0.5">
                {group.items.map((it) => {
                  const active = activeHref === it.href;
                  const Icon =
                    (Icons[it.icon as keyof typeof Icons] as React.ComponentType<{
                      size?: number;
                    }>) || Icons.Circle;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-ink-2 hover:bg-bg-2 hover:text-ink"
                        }`}
                      >
                        <Icon size={17} />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg/80 px-5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-ink lg:hidden"
            aria-label="Menü"
          >
            <Icons.Menu size={20} />
          </button>

          <div className="flex flex-1 items-center justify-end gap-2.5">
            <BildirimZili userId={user.id} role={user.role} dept={user.dept} />
            <ThemeToggle />
            <div className="flex items-center gap-2.5 rounded-full border border-line bg-bg-1 py-1.5 pl-3 pr-1.5">
              <span className="size-2 rounded-full bg-ok" />
              <span className="text-sm font-medium text-ink">{user.name}</span>
              <span className="eyebrow hidden !text-[9.5px] sm:inline">
                {user.isAdmin || user.role === "captain"
                  ? (ROLE_LABELS[user.role] || "Üye").toLocaleUpperCase("tr")
                  : DEPT_LABELS[user.dept]?.toLocaleUpperCase("tr") || "ÜYE"}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="ml-1 rounded-full bg-bg-3 px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-bad/20 hover:text-bad"
              >
                Çıkış
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
