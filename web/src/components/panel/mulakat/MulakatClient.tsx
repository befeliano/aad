"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  TriangleAlert,
  UserPlus,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { BECERILER, sorulariGetir, beceriEtiketi } from "@/lib/interview";
import { fmtDate } from "@/lib/format";
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

type Durum = "planlandi" | "yapildi" | "kabul" | "red" | "beklemede";

const DURUMLAR = ["planlandi", "yapildi", "kabul", "red", "beklemede"] as const;

const DURUM_META: Record<
  Durum,
  { etiket: string; tone: "neutral" | "info" | "ok" | "bad" | "warn" }
> = {
  planlandi: { etiket: "Planlandı", tone: "neutral" },
  yapildi: { etiket: "Görüşüldü", tone: "info" },
  kabul: { etiket: "Kabul", tone: "ok" },
  red: { etiket: "Red", tone: "bad" },
  beklemede: { etiket: "Beklemede", tone: "warn" },
};

interface Mulakat {
  id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  program: string | null;
  email: string | null;
  phone: string | null;
  dept: string;
  skills: string[];
  answers: Record<string, string>;
  score: number | null;
  notes: string | null;
  status: Durum;
  interviewed_at: string | null;
  created_at: string;
}

export function MulakatClient({
  userId,
  isAdmin,
  myDept,
}: {
  userId: string;
  isAdmin: boolean;
  myDept: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [kayitlar, setKayitlar] = useState<Mulakat[]>([]);
  const [loading, setLoading] = useState(true);
  const [yok, setYok] = useState(false);
  const [q, setQ] = useState("");
  const [durumFiltre, setDurumFiltre] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Mulakat | null>(null);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Mulakat | null>(null);

  /* Form durumu — departman değişince beceri ve sorular yenilenir */
  const [dept, setDept] = useState<string>(isAdmin ? "yazilim" : myDept);
  const [beceriler, setBeceriler] = useState<Set<string>>(new Set());
  const [cevaplar, setCevaplar] = useState<Record<string, string>>({});
  const [puan, setPuan] = useState<number | null>(null);

  /** Kaptan/yardımcı her birime alır; birim kaptanı yalnızca kendi birimine */
  const secilebilirDepts = useMemo(
    () => (isAdmin ? ([...DEPT_KEYS] as string[]) : myDept ? [myDept] : []),
    [isAdmin, myDept]
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("interviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setYok(true);
      setKayitlar([]);
    } else {
      setYok(false);
      setKayitlar((data as Mulakat[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtreli = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return kayitlar.filter((m) => {
      if (durumFiltre && m.status !== durumFiltre) return false;
      if (
        needle &&
        !`${m.first_name} ${m.last_name} ${m.program || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [kayitlar, q, durumFiltre]);

  const sayim = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of kayitlar) c[m.status] = (c[m.status] || 0) + 1;
    return c;
  }, [kayitlar]);

  function formuAc(m: Mulakat | null) {
    setEditing(m);
    const d = m?.dept || (isAdmin ? "yazilim" : myDept) || "yazilim";
    setDept(d);
    setBeceriler(new Set(m?.skills || []));
    setCevaplar(m?.answers || {});
    setPuan(m?.score ?? null);
    setFormOpen(true);
  }

  function beceriDegis(k: string) {
    setBeceriler((v) => {
      const n = new Set(v);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  async function kaydet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ad = reqText(fd.get("first_name"), LIMITS.name);
    const soyad = reqText(fd.get("last_name"), LIMITS.name);
    if (!ad || !soyad) {
      toast("Ad ve soyad zorunlu.", "error");
      return;
    }

    const yasHam = fd.get("age");
    const payload = {
      first_name: ad,
      last_name: soyad,
      age: yasHam ? Number(yasHam) : null,
      program: trimTo(fd.get("program"), LIMITS.name),
      email: trimTo(fd.get("email"), LIMITS.name),
      phone: trimTo(fd.get("phone"), 40),
      dept: oneOf(fd.get("dept"), secilebilirDepts, secilebilirDepts[0] || "yazilim"),
      skills: [...beceriler],
      answers: cevaplar,
      score: puan,
      status: oneOf(fd.get("status"), DURUMLAR, "planlandi"),
      notes: trimTo(fd.get("notes"), LIMITS.longText),
    };

    setSaving(true);
    const { data, error } = editing
      ? await supabase
          .from("interviews")
          .update(payload)
          .eq("id", editing.id)
          .select()
      : await supabase
          .from("interviews")
          .insert([{ ...payload, created_by: userId, interviewer: userId }])
          .select();
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    void logAction(
      supabase,
      editing ? "update" : "create",
      "interviews",
      data?.[0]?.id ?? editing?.id ?? null,
      { aday: `${ad} ${soyad}`, birim: payload.dept }
    );
    toast(editing ? "Mülakat güncellendi." : "Mülakat kaydedildi.");
    setFormOpen(false);
    setEditing(null);
    void load();
  }

  async function sil() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("interviews")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      void logAction(supabase, "delete", "interviews", delTarget.id, {
        aday: `${delTarget.first_name} ${delTarget.last_name}`,
      });
      toast("Kayıt silindi.");
    }
    setDelTarget(null);
    void load();
  }

  const formBeceriler = BECERILER[dept] || [];
  const formSorular = sorulariGetir(dept);

  return (
    <>
      <PageHeader
        title="Mülakat Değerlendirme"
        desc="Aday künyesi, birime göre beceri listesi ve sorular. Görüşme sırasında telefondan doldurabilirsiniz."
      >
        <Button onClick={() => formuAc(null)}>
          <Plus size={16} />
          Yeni Mülakat
        </Button>
      </PageHeader>

      {yok ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Mülakat tablosu hazır değil
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                <code>supabase/mulakat.sql</code> dosyasını Supabase SQL
                Editor&apos;da çalıştırın.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Özet */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {DURUMLAR.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurumFiltre(durumFiltre === d ? "" : d)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  durumFiltre === d
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-bg-1 hover:border-line-2"
                }`}
              >
                <div className="display tabular text-2xl text-ink">
                  {sayim[d] || 0}
                </div>
                <div className="eyebrow mt-0.5 !text-[9.5px]">
                  {DURUM_META[d].etiket}
                </div>
              </button>
            ))}
          </div>

          <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Aday ara…"
                className="field !pl-9"
              />
            </div>
            <span className="ml-auto text-xs text-ink-3">
              {filtreli.length} aday
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
                icon={<UserPlus size={28} />}
                title={
                  kayitlar.length === 0 ? "Henüz mülakat yok" : "Sonuç yok"
                }
                desc={
                  kayitlar.length === 0
                    ? "İlk adayı ekleyin; görüşme sırasında doldurabilirsiniz."
                    : "Filtreyi değiştirmeyi deneyin."
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filtreli.map((m) => (
                <Card key={m.id} className="p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-ink">
                          {m.first_name} {m.last_name}
                        </h3>
                        <Badge tone={DURUM_META[m.status].tone}>
                          {DURUM_META[m.status].etiket}
                        </Badge>
                        <Badge tone="neutral">
                          {DEPT_LABELS[m.dept] || m.dept}
                        </Badge>
                        {m.score !== null && (
                          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent">
                            <Star size={12} fill="currentColor" />
                            {m.score}/5
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                        {m.age && <span>{m.age} yaş</span>}
                        {m.program && <span>{m.program}</span>}
                        {m.email && <span className="break-all">{m.email}</span>}
                        {m.interviewed_at && (
                          <span>Görüşme {fmtDate(m.interviewed_at)}</span>
                        )}
                      </div>

                      {m.skills?.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {m.skills.map((k) => (
                            <span
                              key={k}
                              className="rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-ink-2"
                            >
                              {beceriEtiketi(m.dept, k)}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.notes && (
                        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                          {m.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => formuAc(m)}
                        className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                      >
                        Aç
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(m)}
                        className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:border-bad hover:text-bad"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Mülakat formu */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Mülakatı Düzenle" : "Yeni Mülakat"}
        wide
      >
        <form onSubmit={kaydet} className="space-y-5">
          {/* Künye */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad">
              <input
                name="first_name"
                required
                defaultValue={editing?.first_name || ""}
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Soyad">
              <input
                name="last_name"
                required
                defaultValue={editing?.last_name || ""}
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Yaş">
              <input
                name="age"
                type="number"
                min={15}
                max={70}
                defaultValue={editing?.age ?? ""}
                className="field"
              />
            </Field>
            <Field label="Bölüm" hint="Üniversitedeki bölümü">
              <input
                name="program"
                defaultValue={editing?.program || ""}
                maxLength={LIMITS.name}
                placeholder="örn. Bilgisayar Müh."
                className="field"
              />
            </Field>
            <Field label="Alınacağı birim">
              <select
                name="dept"
                value={dept}
                onChange={(e) => {
                  setDept(e.target.value);
                  /* Birim değişince beceriler geçersiz kalır */
                  setBeceriler(new Set());
                }}
                className="field"
              >
                {secilebilirDepts.map((k) => (
                  <option key={k} value={k}>
                    {DEPT_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-posta" hint="İsteğe bağlı">
              <input
                name="email"
                type="email"
                defaultValue={editing?.email || ""}
                className="field"
              />
            </Field>
            <Field label="Telefon" hint="İsteğe bağlı">
              <input
                name="phone"
                defaultValue={editing?.phone || ""}
                maxLength={40}
                className="field"
              />
            </Field>
          </div>

          {/* Beceriler — birime göre */}
          {formBeceriler.length > 0 && (
            <div className="rounded-xl border border-line bg-bg-1 p-4">
              <div className="eyebrow mb-3 !text-[10px]">
                Bildiği programlar / beceriler
              </div>
              <div className="flex flex-wrap gap-2">
                {formBeceriler.map((b) => {
                  const secili = beceriler.has(b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      aria-pressed={secili}
                      onClick={() => beceriDegis(b.key)}
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                        secili
                          ? "border-accent bg-accent text-white"
                          : "border-line bg-bg text-ink-2 hover:border-ink-3 hover:text-ink"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sorular — birime göre + genel */}
          <div className="space-y-4">
            <div className="eyebrow !text-[10px]">Sorular</div>
            {formSorular.map((s) => (
              <Field key={s.key} label={s.label}>
                {s.uzun ? (
                  <textarea
                    rows={3}
                    value={cevaplar[s.key] || ""}
                    onChange={(e) =>
                      setCevaplar((v) => ({ ...v, [s.key]: e.target.value }))
                    }
                    maxLength={LIMITS.longText}
                    className="field resize-y"
                  />
                ) : (
                  <input
                    value={cevaplar[s.key] || ""}
                    onChange={(e) =>
                      setCevaplar((v) => ({ ...v, [s.key]: e.target.value }))
                    }
                    maxLength={LIMITS.shortText}
                    className="field"
                  />
                )}
              </Field>
            ))}
          </div>

          {/* Değerlendirme */}
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Puan" hint="1 = zayıf, 5 = çok iyi">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={puan === n}
                    onClick={() => setPuan(puan === n ? null : n)}
                    className={`flex size-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                      puan !== null && n <= puan
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-bg text-ink-3 hover:border-ink-3"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Durum">
              <select
                name="status"
                defaultValue={editing?.status || "planlandi"}
                className="field"
              >
                {DURUMLAR.map((d) => (
                  <option key={d} value={d}>
                    {DURUM_META[d].etiket}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Genel not" hint="Görüşmede aklınızda kalanlar">
            <textarea
              name="notes"
              rows={3}
              defaultValue={editing?.notes || ""}
              maxLength={LIMITS.longText}
              className="field resize-y"
            />
          </Field>

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
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        title="Mülakat kaydını sil"
        message={`${delTarget?.first_name} ${delTarget?.last_name} kaydı kalıcı olarak silinecek.`}
        onCancel={() => setDelTarget(null)}
        onConfirm={sil}
      />
    </>
  );
}
