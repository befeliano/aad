"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  TriangleAlert,
  Wrench,
  CircleCheck,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { reqText, trimTo, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

type Durum = "acik" | "inceleniyor" | "cozuldu";
type Onem = "dusuk" | "orta" | "yuksek" | "kritik";

const DURUMLAR = ["acik", "inceleniyor", "cozuldu"] as const;
const ONEMLER = ["dusuk", "orta", "yuksek", "kritik"] as const;
const ARIZA_DEPTS = [...DEPT_KEYS, "ortak"] as const;

const DURUM_META: Record<Durum, { etiket: string; tone: "bad" | "warn" | "ok" }> = {
  acik: { etiket: "Açık", tone: "bad" },
  inceleniyor: { etiket: "İnceleniyor", tone: "warn" },
  cozuldu: { etiket: "Çözüldü", tone: "ok" },
};

const ONEM_META: Record<Onem, { etiket: string; tone: "neutral" | "info" | "warn" | "bad" }> = {
  dusuk: { etiket: "Düşük", tone: "neutral" },
  orta: { etiket: "Orta", tone: "info" },
  yuksek: { etiket: "Yüksek", tone: "warn" },
  kritik: { etiket: "Kritik", tone: "bad" },
};

interface Ariza {
  id: string;
  title: string;
  description: string | null;
  dept: string;
  subject: string | null;
  severity: Onem;
  status: Durum;
  resolution: string | null;
  resolved_at: string | null;
  reported_by: string | null;
  created_at: string;
}

export function ArizalarClient({
  userId,
  isAdmin,
  myDept,
  role,
}: {
  userId: string;
  isAdmin: boolean;
  myDept: string;
  role: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [kayitlar, setKayitlar] = useState<Ariza[]>([]);
  const [loading, setLoading] = useState(true);
  const [yok, setYok] = useState(false);
  const [q, setQ] = useState("");
  const [durumFiltre, setDurumFiltre] = useState<string>("acik");
  const [deptFiltre, setDeptFiltre] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ariza | null>(null);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Ariza | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("faults")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setYok(true);
      setKayitlar([]);
    } else {
      setYok(false);
      setKayitlar((data as Ariza[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("arizalar-canli")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "faults" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  /** Düzenleme yetkisi: bildiren + o birimin kaptanı + kaptan/yardımcı */
  const duzenleyebilir = useCallback(
    (a: Ariza) =>
      isAdmin ||
      a.reported_by === userId ||
      (role === "captain" && !!myDept && a.dept === myDept),
    [isAdmin, userId, role, myDept]
  );

  const filtreli = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return kayitlar.filter((a) => {
      if (durumFiltre && a.status !== durumFiltre) return false;
      if (deptFiltre && a.dept !== deptFiltre) return false;
      if (
        needle &&
        !`${a.title} ${a.subject || ""} ${a.description || ""} ${a.resolution || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [kayitlar, q, durumFiltre, deptFiltre]);

  /** Aynı parçanın daha önce kaç kez bozulduğu — tekrar eden arızayı yakalar */
  const tekrarSayisi = useCallback(
    (a: Ariza) => {
      const k = (a.subject || "").trim().toLocaleLowerCase("tr");
      if (!k) return 0;
      return kayitlar.filter(
        (x) => (x.subject || "").trim().toLocaleLowerCase("tr") === k
      ).length;
    },
    [kayitlar]
  );

  const acikSayi = kayitlar.filter((a) => a.status !== "cozuldu").length;

  async function kaydet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = reqText(fd.get("title"), LIMITS.title);
    if (!title) {
      toast("Başlık zorunlu.", "error");
      return;
    }

    const payload = {
      title,
      description: trimTo(fd.get("description"), LIMITS.longText),
      subject: trimTo(fd.get("subject"), LIMITS.name),
      dept: oneOf(fd.get("dept"), ARIZA_DEPTS, "ortak"),
      severity: oneOf(fd.get("severity"), ONEMLER, "orta"),
      status: oneOf(fd.get("status"), DURUMLAR, "acik"),
      resolution: trimTo(fd.get("resolution"), LIMITS.longText),
    };

    setSaving(true);
    const { data, error } = editing
      ? await supabase.from("faults").update(payload).eq("id", editing.id).select()
      : await supabase
          .from("faults")
          .insert([{ ...payload, reported_by: userId }])
          .select();
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    void logAction(
      supabase,
      editing ? "update" : "create",
      "faults",
      data?.[0]?.id ?? editing?.id ?? null,
      { title: payload.title, dept: payload.dept }
    );
    toast(editing ? "Arıza güncellendi." : "Arıza kaydedildi.");
    setFormOpen(false);
    setEditing(null);
    void load();
  }

  async function durumDegistir(a: Ariza, yeni: Durum) {
    const { error } = await supabase
      .from("faults")
      .update({ status: yeni })
      .eq("id", a.id);
    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "update", "faults", a.id, { durum: yeni });
    void load();
  }

  async function sil() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("faults")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      void logAction(supabase, "delete", "faults", delTarget.id, {
        title: delTarget.title,
      });
      toast("Kayıt silindi.");
    }
    setDelTarget(null);
    void load();
  }

  return (
    <>
      <PageHeader
        title="Arıza Günlüğü"
        desc="Bozulan ne varsa buraya yazın. Aynı parça tekrar bozulduğunda ne yapıldığı burada duruyor."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Arıza Bildir
        </Button>
      </PageHeader>

      {yok ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Arıza tablosu hazır değil
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                <code>supabase/ariza-gunlugu.sql</code> dosyasını Supabase SQL
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
                placeholder="Arıza, parça veya çözüm ara…"
                className="field !pl-9"
              />
            </div>
            <select
              value={durumFiltre}
              onChange={(e) => setDurumFiltre(e.target.value)}
              className="field !w-auto"
              aria-label="Duruma göre filtrele"
            >
              <option value="">Tüm durumlar</option>
              {DURUMLAR.map((d) => (
                <option key={d} value={d}>
                  {DURUM_META[d].etiket}
                </option>
              ))}
            </select>
            <select
              value={deptFiltre}
              onChange={(e) => setDeptFiltre(e.target.value)}
              className="field !w-auto"
              aria-label="Departmana göre filtrele"
            >
              <option value="">Tüm birimler</option>
              {ARIZA_DEPTS.map((k) => (
                <option key={k} value={k}>
                  {DEPT_LABELS[k] || k}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-ink-3">
              {acikSayi} açık · {filtreli.length} gösteriliyor
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
                icon={<Wrench size={28} />}
                title={
                  kayitlar.length === 0 ? "Henüz arıza kaydı yok" : "Sonuç yok"
                }
                desc={
                  kayitlar.length === 0
                    ? "Bozulan ilk şeyi kaydedin — üç ay sonra buraya bakacaksınız."
                    : "Filtreleri değiştirmeyi deneyin."
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filtreli.map((a) => {
                const tekrar = tekrarSayisi(a);
                const yetki = duzenleyebilir(a);
                return (
                  <Card key={a.id} className="p-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-ink">
                            {a.title}
                          </h3>
                          <Badge tone={DURUM_META[a.status].tone}>
                            {DURUM_META[a.status].etiket}
                          </Badge>
                          <Badge tone={ONEM_META[a.severity].tone}>
                            {ONEM_META[a.severity].etiket}
                          </Badge>
                          <Badge tone="neutral">
                            {DEPT_LABELS[a.dept] || a.dept}
                          </Badge>
                          {tekrar > 1 && (
                            <span
                              title="Aynı parça daha önce de arıza verdi"
                              className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn"
                            >
                              <History size={11} />
                              {tekrar}. kez
                            </span>
                          )}
                        </div>

                        {a.subject && (
                          <div className="mt-1.5 text-[12.5px] text-ink-3">
                            Konu: <span className="text-ink-2">{a.subject}</span>
                          </div>
                        )}
                        {a.description && (
                          <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">
                            {a.description}
                          </p>
                        )}
                        {a.resolution && (
                          <div className="mt-3 rounded-xl border border-ok/30 bg-ok/8 p-3">
                            <div className="eyebrow mb-1 !text-[9.5px] !text-ok">
                              Çözüm
                            </div>
                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                              {a.resolution}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 text-[11.5px] text-ink-3">
                          {fmtDateTime(a.created_at)}
                          {a.resolved_at && (
                            <> · Çözüldü {fmtDateTime(a.resolved_at)}</>
                          )}
                        </div>
                      </div>

                      {yetki && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {a.status !== "cozuldu" && (
                            <button
                              type="button"
                              onClick={() => durumDegistir(a, "cozuldu")}
                              className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 px-3 py-1.5 text-[12.5px] font-semibold text-ok transition-colors hover:bg-ok/10"
                            >
                              <CircleCheck size={14} />
                              Çözüldü
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(a);
                              setFormOpen(true);
                            }}
                            className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                          >
                            Düzenle
                          </button>
                          {(isAdmin || a.reported_by === userId) && (
                            <button
                              type="button"
                              onClick={() => setDelTarget(a)}
                              className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:border-bad hover:text-bad"
                            >
                              Sil
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Bildir / düzenle */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Arızayı Düzenle" : "Arıza Bildir"}
        wide
      >
        <form onSubmit={kaydet} className="space-y-4">
          <Field label="Ne oldu?" hint="Tek cümlelik başlık">
            <input
              name="title"
              required
              defaultValue={editing?.title || ""}
              maxLength={LIMITS.title}
              placeholder="örn. Ethernet kablosu bağlantıyı koparıyor"
              className="field"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Konu" hint="Hangi parça / sistem">
              <input
                name="subject"
                defaultValue={editing?.subject || ""}
                maxLength={LIMITS.name}
                placeholder="örn. Ethernet kablosu"
                className="field"
              />
            </Field>
            <Field label="Birim">
              <select
                name="dept"
                defaultValue={editing?.dept || myDept || "ortak"}
                className="field"
              >
                {ARIZA_DEPTS.map((k) => (
                  <option key={k} value={k}>
                    {DEPT_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Önem">
              <select
                name="severity"
                defaultValue={editing?.severity || "orta"}
                className="field"
              >
                {ONEMLER.map((o) => (
                  <option key={o} value={o}>
                    {ONEM_META[o].etiket}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Açıklama" hint="Belirti, ne zaman oluyor, nasıl tekrarlanıyor">
            <textarea
              name="description"
              rows={4}
              defaultValue={editing?.description || ""}
              maxLength={LIMITS.longText}
              className="field resize-y"
            />
          </Field>

          {editing && (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <Field label="Durum">
                <select
                  name="status"
                  defaultValue={editing.status}
                  className="field"
                >
                  {DURUMLAR.map((d) => (
                    <option key={d} value={d}>
                      {DURUM_META[d].etiket}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Çözüm"
                hint="Ne yapıldı — tekrarında ilk buraya bakılacak"
              >
                <textarea
                  name="resolution"
                  rows={3}
                  defaultValue={editing.resolution || ""}
                  maxLength={LIMITS.longText}
                  className="field resize-y"
                />
              </Field>
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-line pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              {editing ? "Kaydet" : "Bildir"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        title="Arıza kaydını sil"
        message={`"${delTarget?.title}" kaydı kalıcı olarak silinecek.`}
        onCancel={() => setDelTarget(null)}
        onConfirm={sil}
      />
    </>
  );
}
