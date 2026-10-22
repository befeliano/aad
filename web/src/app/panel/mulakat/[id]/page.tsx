import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Mulakat } from "@/lib/interview";
import { AdayClient } from "@/components/panel/mulakat/AdayClient";
import { Card } from "@/components/ui/Kit";
import { AccessDenied } from "@/components/panel/AccessDenied";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** generateMetadata ve sayfa aynı satırı ister — tek sorgu */
const adayGetir = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { aday: (data as Mulakat | null) ?? null, hata: error?.message ?? null };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Aday" };
  const { aday } = await adayGetir(id);
  return {
    title: aday ? `${aday.first_name} ${aday.last_name}`.trim() : "Aday",
  };
}

/**
 * Aday mülakat sayfası: üstte başvuru formundan gelen sabit bilgiler,
 * yanında/altında görüşme notu. Not otomatik kaydedilir.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const session = await getSession();
  if (!session) redirect(`/giris?next=/panel/mulakat/${id}`);
  // Tam yetkililer + birim kaptanları (mulakat-yetki.sql)
  if (!session.isAdmin && session.role !== "captain") {
    return (
      <AccessDenied
        title="Mülakatlar"
        mesaj="Mülakatlar takım kaptanı, yardımcısı, danışmanlar ve birim kaptanlarına açıktır."
      />
    );
  }

  const { aday, hata } = await adayGetir(id);
  if (hata) {
    return (
      <Card className="p-6">
        <h1 className="text-[15px] font-semibold text-ink">Aday yüklenemedi</h1>
        <p className="mt-1 text-sm text-ink-2">{hata}</p>
      </Card>
    );
  }
  if (!aday) notFound();

  // mulakat-form.sql çalıştırılmadıysa yeni kolonlar yok
  if (!("notes_version" in aday)) {
    return (
      <Card className="p-6">
        <h1 className="text-[15px] font-semibold text-ink">
          Veritabanı güncellemesi gerekli
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          <code>supabase/mulakat-form.sql</code> dosyasını Supabase SQL
          Editor&apos;da çalıştırın.
        </p>
      </Card>
    );
  }

  const silebilir =
    session.isAdmin ||
    (session.role === "captain" && !!session.dept && session.dept === aday.dept);

  return (
    <AdayClient
      initial={aday}
      userId={session.userId}
      silebilir={silebilir}
    />
  );
}
