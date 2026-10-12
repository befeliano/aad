"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  Mail,
  MailOpen,
  Reply,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
import { createClient } from "@/lib/supabase/client";
import { fmtDateTime } from "@/lib/format";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Badge, Card, ConfirmDialog, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

interface Mesaj {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  handled: boolean;
  handled_at: string | null;
  created_at: string;
}

export function MesajlarClient({ isAdmin }: { isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [loading, setLoading] = useState(true);
  const [yok, setYok] = useState(false);
  const [q, setQ] = useKaliciFiltre("mesajlar.q", "");
  const [sadeceYeni, setSadeceYeni] = useKaliciFiltre("mesajlar.sadeceYeni", true);
  const [delTarget, setDelTarget] = useState<Mesaj | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setYok(true);
      setMesajlar([]);
    } else {
      setYok(false);
      setMesajlar((data as Mesaj[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("mesajlar-canli")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtreli = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return mesajlar.filter((m) => {
      if (sadeceYeni && m.handled) return false;
      if (
        needle &&
        !`${m.name || ""} ${m.email || ""} ${m.subject || ""} ${m.message || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [mesajlar, q, sadeceYeni]);

  const yeniSayi = mesajlar.filter((m) => !m.handled).length;

  async function isaretle(m: Mesaj, deger: boolean) {
    const { error } = await supabase
      .from("contact_messages")
      .update({ handled: deger })
      .eq("id", m.id);
    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "update", "contact_messages", m.id, {
      ilgilenildi: deger,
    });
    void load();
  }

  async function sil() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("contact_messages")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      void logAction(supabase, "delete", "contact_messages", delTarget.id, {});
      toast("Mesaj silindi.");
    }
    setDelTarget(null);
    void load();
  }

  return (
    <>
      <PageHeader
        title="Gelen Kutusu"
        desc="Siteden gelen iletişim formu mesajları. İlgilenilenleri işaretleyin ki iki kişi aynı mesaja dönmesin."
      />

      {yok ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Mesaj tablosu okunamıyor
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                <code>supabase/gelen-kutusu.sql</code> dosyasını Supabase SQL
                Editor&apos;da çalıştırın.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ad, e-posta veya mesaj ara…"
                className="field !pl-9"
              />
            </div>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={sadeceYeni}
                onChange={(e) => setSadeceYeni(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Sadece ilgilenilmemişler
            </label>
            <span className="ml-auto text-xs text-ink-3">
              {yeniSayi} yeni · {mesajlar.length} toplam
            </span>
          </Card>

          {loading ? (
            <Card className="flex items-center gap-2 p-8 text-sm text-ink-3">
              <Loader2 size={16} className="animate-spin" />
              Yükleniyor…
            </Card>
          ) : filtreli.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={<Mail size={28} />}
                title={
                  mesajlar.length === 0
                    ? "Henüz mesaj yok"
                    : sadeceYeni
                      ? "Bekleyen mesaj yok"
                      : "Sonuç yok"
                }
                desc={
                  mesajlar.length === 0
                    ? "Siteden gelen iletişim formu mesajları burada birikecek."
                    : "Hepsi işaretlenmiş görünüyor."
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filtreli.map((m) => (
                <Card
                  key={m.id}
                  className={`p-5 ${m.handled ? "opacity-70" : ""}`}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        m.handled
                          ? "bg-bg-2 text-ink-3"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {m.handled ? <MailOpen size={17} /> : <Mail size={17} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-ink">
                          {m.subject || "Konusuz"}
                        </h3>
                        {m.handled ? (
                          <Badge tone="ok">İlgilenildi</Badge>
                        ) : (
                          <Badge tone="accent">Yeni</Badge>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                        <span>{m.name || "İsimsiz"}</span>
                        {m.email && (
                          <span className="break-all">{m.email}</span>
                        )}
                        <span>{fmtDateTime(m.created_at)}</span>
                        {m.handled_at && (
                          <span>İşaretlendi {fmtDateTime(m.handled_at)}</span>
                        )}
                      </div>

                      {m.message && (
                        <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">
                          {m.message}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {m.email && (
                          <a
                            href={`mailto:${m.email}?subject=${encodeURIComponent(
                              `Re: ${m.subject || "İletişim"}`
                            )}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-transform hover:scale-105"
                          >
                            <Reply size={14} />
                            Yanıtla
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => isaretle(m, !m.handled)}
                          className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                        >
                          {m.handled
                            ? "İlgilenilmedi olarak işaretle"
                            : "İlgilenildi"}
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDelTarget(m)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:border-bad hover:text-bad"
                          >
                            <Trash2 size={13} />
                            Sil
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!delTarget}
        title="Mesajı sil"
        message={`${delTarget?.name || "İsimsiz"} kişisinden gelen mesaj kalıcı olarak silinecek.`}
        onCancel={() => setDelTarget(null)}
        onConfirm={sil}
      />
    </>
  );
}
