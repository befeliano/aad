import Link from "next/link";
import { Boxes, Plane, ClipboardList, KanbanSquare, ArrowUpRight } from "lucide-react";
import { getSession, canAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/panel/PageHeader";
import { UyariTablosu } from "@/components/panel/UyariTablosu";
import { UcakDurumu } from "@/components/panel/UcakDurumu";
import { DEPT_LABELS } from "@/lib/constants";

export default async function PanelHome() {
  const session = await getSession();
  const supabase = await createClient();

  // RLS zaten filtreler; count'lar erişilebilir kayıtları sayar
  const [needs, flights, stock, tasks] = await Promise.all([
    supabase.from("needs").select("id", { count: "exact", head: true }).eq("done", false),
    supabase.from("flights").select("id", { count: "exact", head: true }).gte("flight_date", new Date().toISOString().slice(0, 10)),
    supabase.from("stock").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
  ]);

  const name =
    session?.profile?.full_name || session?.email?.split("@")[0] || "Üye";

  /* aircraft_sections RLS'iyle aynı küme */
  const ilerlemeYazabilir = session
    ? canAccess(session, {
        allowedDepts: ["yazilim", "tasarim", "yapisal", "kompozit", "aviyonik"],
      })
    : false;

  const stats = [
    { label: "Açık İhtiyaç", value: needs.count ?? 0, href: "/panel/ihtiyaclar", icon: ClipboardList },
    { label: "Yaklaşan Uçuş", value: flights.count ?? 0, href: "/panel/ucuslar", icon: Plane },
    { label: "Envanter Kaydı", value: stock.count ?? 0, href: "/panel/envanter", icon: Boxes },
    { label: "Açık Görev", value: tasks.count ?? 0, href: "/panel/gorevler", icon: KanbanSquare },
  ];

  return (
    <>
      <PageHeader
        title={`Merhaba, ${name}`}
        desc={
          session?.dept
            ? `${DEPT_LABELS[session.dept] || session.dept} departmanı · takım paneli`
            : "Takım paneli"
        }
      />

      {/* Kaptan yardımcısının isteği: uyarılar en başta */}
      <UyariTablosu />

      {/* Yapımdaki uçağın kuşbakışı durumu — herkes görür,
          yüzdeleri yalnızca teknik departmanlar günceller */}
      <UcakDurumu canWrite={ilerlemeYazabilir} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group relative overflow-hidden rounded-2xl border border-line bg-bg-1 p-6 transition-colors hover:border-line-2"
            >
              <div className="flex items-start justify-between">
                <Icon size={20} className="text-ink-3" />
                <ArrowUpRight
                  size={16}
                  className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              <div className="display mt-6 text-5xl text-ink">{s.value}</div>
              <div className="eyebrow mt-1 !text-[10px]">
                {s.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-bg-1 p-8">
        <h2 className="text-lg font-bold text-ink">Hızlı Erişim</h2>
        <p className="mt-1 text-sm text-ink-2">
          Sık kullanılan modüllere hızlıca gidin.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {[
            { href: "/panel/envanter", label: "Envantere malzeme ekle" },
            { href: "/panel/ucuslar", label: "Uçuş planla" },
            { href: "/panel/gorevler", label: "Görev oluştur" },
            { href: "/panel/ihtiyaclar", label: "İhtiyaç bildir" },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="rounded-full border border-line-2 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
