"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Search,
  Star,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { DURUMLAR, DURUM_META, type Mulakat } from "@/lib/interview";
import { telefonGoster } from "@/lib/interview-form";
import { fmtDate } from "@/lib/format";
import { reqText, trimTo, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

/** Liste için gereken kolonlar — form_data ve not gövdesi burada çekilmez */
type Satir = Pick<
  Mulakat,
  | "id"
  | "first_name"
  | "last_name"
  | "program"
  | "phone"
  | "email"
  | "dept"
  | "status"
  | "score"
  | "source"
  | "submitted_at"
  | "created_at"
>;

const KOLONLAR =
  "id, first_name, last_name, program, phone, email, dept, status, score, source, submitted_at, created_at";

/** Başvuru anı: formdan geldiyse gönderim, elle eklendiyse oluşturma */
const basvuruAni = (m: Satir) => m.submitted_at || m.created_at;

export function MulakatClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();

  const [kayitlar, setKayitlar] = useState<Satir[]>([]);
  const [loading, setLoading] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [q, setQ] = useKaliciFiltre("mulakat.q", "");
  const [durumFiltre, setDurumFiltre] = useKaliciFiltre("mulakat.durumFiltre", "");
  const [birimFiltre, setBirimFiltre] = useKaliciFiltre("mulakat.birimFiltre", "");

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("interviews").select(KOLONLAR);

    if (error) {
      setHata(error.message);
      setKayitlar([]);
    } else {
      setHata(null);
      setKayitlar(
        ((data as Satir[]) || []).sort((a, b) =>
          basvuruAni(b).localeCompare(basvuruAni(a))
        )
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Formdan yeni başvuru düşünce liste kendiliğinden yenilenir
    const ch = supabase
      .channel("mulakat-liste")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interviews" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtreli = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return kayitlar.filter((m) => {
      if (durumFiltre && m.status !== durumFiltre) return false;
      if (birimFiltre && (m.dept || "") !== birimFiltre) return false;
      if (
        needle &&
        !`${m.first_name} ${m.last_name} ${m.program || ""} ${m.email || ""} ${m.phone || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [kayitlar, q, durumFiltre, birimFiltre]);

  const sayim = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of kayitlar) c[m.status] = (c[m.status] || 0) + 1;
    return c;
  }, [kayitlar]);

  async function ekle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ad = reqText(fd.get("first_name"), LIMITS.name);
    const soyad = reqText(fd.get("last_name"), LIMITS.name);
    if (!ad) {
      toast("Ad zorunlu.", "error");
      return;
    }

    const dept = oneOf(fd.get("dept"), ["", ...DEPT_KEYS] as const, "");
    const payload = {
      first_name: ad,
      last_name: soyad,
      phone: trimTo(fd.get("phone"), 40),
      email: trimTo(fd.get("email"), LIMITS.name),
      program: trimTo(fd.get("program"), LIMITS.name),
      dept: dept || null,
      source: "manuel",
      created_by: userId,
      interviewer: userId,
    };

    setSaving(true);
    const { data, error } = await supabase
      .from("interviews")
      .insert([payload])
      .select("id")
      .single();
    setSaving(false);

    if (error || !data) {
      toast("Kaydedilemedi: " + (error?.message ?? "bilinmeyen hata"), "error");
      return;
    }
    void logAction(supabase, "create", "interviews", data.id, {
      aday: `${ad} ${soyad}`.trim(),
      birim: payload.dept,
    });
    setFormOpen(false);
    router.push(`/panel/mulakat/${data.id}`);
  }

  return (
    <>
      <PageHeader
        title="Mülakatlar"
        desc="Başvuru formunu dolduran her aday buraya otomatik düşer. Adayın adına tıklayın, görüşme notunuzu yazın — not kendiliğinden kaydedilir."
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} />
          Aday Ekle
        </Button>
      </PageHeader>

      {hata ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Mülakat tablosu hazır değil
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Supabase SQL Editor&apos;da önce <code>supabase/mulakat.sql</code>{" "}
                (daha önce çalıştırılmadıysa), sonra{" "}
                <code>supabase/mulakat-form.sql</code> dosyasını çalıştırın.
              </p>
              <p className="mt-2 text-xs text-ink-3">{hata}</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Özet — tıklayınca filtreler */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {DURUMLAR.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={durumFiltre === d}
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
                placeholder="Ad, bölüm, telefon veya e-posta ara…"
                aria-label="Aday ara"
                className="field !pl-9"
              />
            </div>
            <select
              value={birimFiltre}
              onChange={(e) => setBirimFiltre(e.target.value)}
              aria-label="Birime göre filtrele"
              className="field !w-auto"
            >
              <option value="">Tüm birimler</option>
              {DEPT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {DEPT_LABELS[k] || k}
                </option>
              ))}
            </select>
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
                title={kayitlar.length === 0 ? "Henüz aday yok" : "Sonuç yok"}
                desc={
                  kayitlar.length === 0
                    ? "Başvuru formu bağlandığında adaylar burada kendiliğinden belirir. Elle de ekleyebilirsiniz."
                    : "Filtreyi değiştirmeyi deneyin."
                }
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {filtreli.map((m) => (
                <Link
                  key={m.id}
                  href={`/panel/mulakat/${m.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink group-hover:text-accent">
                        {m.first_name} {m.last_name}
                      </span>
                      <Badge tone={DURUM_META[m.status].tone}>
                        {DURUM_META[m.status].etiket}
                      </Badge>
                      {m.dept && (
                        <Badge tone="neutral">
                          {DEPT_LABELS[m.dept] || m.dept}
                        </Badge>
                      )}
                      {m.source === "form" && (
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px] text-ink-3"
                          title="Başvuru formundan geldi"
                        >
                          <FileText size={12} />
                          Form
                        </span>
                      )}
                      {m.score !== null && (
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent">
                          <Star size={12} fill="currentColor" />
                          {m.score}/5
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-3">
                      {m.program && <span>{m.program}</span>}
                      {m.phone && (
                        <span className="tabular">{telefonGoster(m.phone)}</span>
                      )}
                      <span>Başvuru {fmtDate(basvuruAni(m))}</span>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </Link>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Elle aday ekleme — formu doldurmamış biri için */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Aday Ekle">
        <form onSubmit={ekle} className="space-y-4">
          <p className="text-[13px] text-ink-3">
            Formu dolduranlar zaten otomatik ekleniyor. Bunu yalnızca formu
            doldurmamış biriyle görüşecekseniz kullanın.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad">
              <input
                name="first_name"
                required
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Soyad">
              <input name="last_name" maxLength={LIMITS.name} className="field" />
            </Field>
            <Field label="Telefon" hint="İsteğe bağlı">
              <input
                name="phone"
                type="tel"
                maxLength={40}
                className="field"
              />
            </Field>
            <Field label="E-posta" hint="İsteğe bağlı">
              <input
                name="email"
                type="email"
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Üniversite / bölüm" hint="İsteğe bağlı">
              <input
                name="program"
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Birim">
              <select name="dept" defaultValue="" className="field">
                <option value="">Seçilmedi</option>
                {DEPT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {DEPT_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2.5 border-t border-line pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              Ekle ve Aç
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
