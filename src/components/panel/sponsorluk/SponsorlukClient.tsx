"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Download,
  Wallet,
  TrendingDown,
  PiggyBank,
  HandCoins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { fmtMoney, fmtDate, toCSV, downloadFile } from "@/lib/format";
import { reqText, trimTo, safeNumber, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Sponsor, Allocation } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

export function SponsorlukClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delSponsor, setDelSponsor] = useState<Sponsor | null>(null);
  const [delAlloc, setDelAlloc] = useState<Allocation | null>(null);
  const [overspendConfirm, setOverspendConfirm] = useState<{
    payload: Record<string, unknown>;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [s, a] = await Promise.all([
      supabase.from("sponsors").select("*").order("date", { ascending: false }),
      supabase
        .from("allocations")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (s.error) toast("Sponsorlar yüklenemedi: " + s.error.message, "error");
    else setSponsors((s.data as Sponsor[]) || []);
    if (a.error) toast("Tahsisler yüklenemedi: " + a.error.message, "error");
    else setAllocations((a.data as Allocation[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const chans = ["sponsors", "allocations"].map((tbl) =>
      supabase
        .channel(`realtime:${tbl}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: tbl },
          () => load()
        )
        .subscribe()
    );
    return () => {
      chans.forEach((c) => supabase.removeChannel(c));
    };
  }, [supabase, load]);

  const totals = useMemo(() => {
    const income = sponsors.reduce((a, s) => a + Number(s.amount || 0), 0);
    const spent = allocations.reduce((a, x) => a + Number(x.amount || 0), 0);
    return { income, spent, remaining: income - spent };
  }, [sponsors, allocations]);

  const byDept = useMemo(() => {
    const m: Record<string, number> = {};
    allocations.forEach((a) => {
      m[a.dept] = (m[a.dept] || 0) + Number(a.amount || 0);
    });
    const max = Math.max(1, ...Object.values(m));
    return DEPT_KEYS.map((k) => ({
      key: k,
      label: DEPT_LABELS[k],
      value: m[k] || 0,
      pct: ((m[k] || 0) / max) * 100,
    }));
  }, [allocations]);

  async function saveSponsor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = reqText(fd.get("name"), LIMITS.name);
    if (!name) {
      toast("Sponsor adı zorunlu.", "error");
      return;
    }
    const payload = {
      name,
      amount: safeNumber(fd.get("amount"), { min: 0, max: 1e10 }),
      date: trimTo(fd.get("date"), 20) || new Date().toISOString().slice(0, 10),
      note: trimTo(fd.get("note"), LIMITS.shortText),
      created_by: userId,
    };

    setSaving(true);
    const { data, error } = await supabase.from("sponsors").insert([payload]).select();
    setSaving(false);
    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(supabase, "create", "sponsors", data?.[0]?.id ?? null, {
      name,
      amount: payload.amount,
    });
    toast("Sponsor kaydedildi.");
    setSponsorOpen(false);
    load();
  }

  async function insertAllocation(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("allocations")
      .insert([payload])
      .select();
    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(supabase, "create", "allocations", data?.[0]?.id ?? null, payload);
    toast("Tahsis kaydedildi.");
    setAllocOpen(false);
    load();
  }

  async function saveAlloc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = safeNumber(fd.get("amount"), { min: 0, max: 1e10 });
    const payload = {
      dept: oneOf(fd.get("dept"), DEPT_KEYS, "ortak"),
      amount,
      purpose: trimTo(fd.get("purpose"), LIMITS.shortText),
      created_by: userId,
    };

    if (totals.spent + amount > totals.income) {
      setAllocOpen(false);
      setOverspendConfirm({
        payload,
        message: `Bu tahsis kalan bütçeyi (${fmtMoney(
          totals.remaining
        )} ₺) aşıyor. Yine de kaydedilsin mi?`,
      });
      return;
    }

    setSaving(true);
    await insertAllocation(payload);
    setSaving(false);
  }

  async function doDeleteSponsor() {
    if (!delSponsor) return;
    const { error } = await supabase.from("sponsors").delete().eq("id", delSponsor.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "sponsors", delSponsor.id, {
        name: delSponsor.name,
      });
      toast("Sponsor kaydı silindi.");
    }
    setDelSponsor(null);
    load();
  }

  async function doDeleteAlloc() {
    if (!delAlloc) return;
    const { error } = await supabase.from("allocations").delete().eq("id", delAlloc.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "allocations", delAlloc.id, {});
      toast("Tahsis silindi.");
    }
    setDelAlloc(null);
    load();
  }

  function exportCSV() {
    const rows = [
      ...sponsors.map((s) => [
        "Gelir",
        s.name,
        fmtDate(s.date),
        s.amount,
        s.note || "",
      ]),
      ...allocations.map((a) => [
        "Harcama",
        DEPT_LABELS[a.dept] || a.dept,
        fmtDate(a.created_at),
        -Number(a.amount || 0),
        a.purpose || "",
      ]),
    ];
    downloadFile(
      toCSV(["Tür", "Taraf/Departman", "Tarih", "Tutar (₺)", "Açıklama"], rows),
      `sponsorluk-finans-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`${rows.length} kayıt dışa aktarıldı.`);
  }

  return (
    <>
      <PageHeader
        title="Bütçe & Sponsor"
        desc="Sponsor destekleri ve departman tahsisleri. Faturalı harcama raporlaması için kayıt tutulur."
      >
        <Button variant="outline" size="md" onClick={exportCSV}>
          <Download size={15} />
          CSV indir
        </Button>
        <Button variant="outline" size="md" onClick={() => setAllocOpen(true)}>
          <TrendingDown size={15} />
          Tahsis Ekle
        </Button>
        <Button onClick={() => setSponsorOpen(true)}>
          <Plus size={16} />
          Sponsor Ekle
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Tile icon={<Wallet size={18} />} label="Toplam Destek" value={`${fmtMoney(totals.income)} ₺`} />
        <Tile icon={<TrendingDown size={18} />} label="Tahsis Edilen" value={`${fmtMoney(totals.spent)} ₺`} />
        <Tile
          icon={<PiggyBank size={18} />}
          label="Kalan"
          value={`${fmtMoney(totals.remaining)} ₺`}
          tone={totals.remaining < 0 ? "bad" : "ok"}
        />
      </div>

      {/* Departman dağılımı */}
      <Card title="Departman Dağılımı" desc="Tahsis edilen bütçenin departmanlara göre dağılımı" className="mb-5">
        <div className="space-y-3 p-5">
          {byDept.map((d) => (
            <div key={d.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">{d.label}</span>
                <span className="tabular text-[13px] text-ink-2">
                  {fmtMoney(d.value)} ₺
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-3">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${d.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Sponsorlar */}
        <Card title="Sponsor Destekleri" desc={`${sponsors.length} kayıt`}>
          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-ink-3">Yükleniyor…</div>
          ) : sponsors.length === 0 ? (
            <EmptyState
              icon={<HandCoins size={28} />}
              title="Henüz sponsor kaydı yok"
              desc="Gelen destekleri buraya kaydedin."
            />
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {sponsors.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {fmtDate(s.date)}
                      {s.note ? ` · ${s.note}` : ""}
                    </div>
                  </div>
                  <span className="tabular shrink-0 font-bold text-ok">
                    +{fmtMoney(s.amount)} ₺
                  </span>
                  <button
                    type="button"
                    onClick={() => setDelSponsor(s)}
                    aria-label="Sil"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Tahsisler */}
        <Card title="Bütçe Tahsisleri" desc={`${allocations.length} kayıt`}>
          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-ink-3">Yükleniyor…</div>
          ) : allocations.length === 0 ? (
            <EmptyState
              icon={<TrendingDown size={28} />}
              title="Henüz tahsis yok"
              desc="Departmanlara ayrılan bütçeyi buraya girin."
            />
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {allocations.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">
                      {DEPT_LABELS[a.dept] || a.dept}
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {fmtDate(a.created_at)}
                      {a.purpose ? ` · ${a.purpose}` : ""}
                    </div>
                  </div>
                  <span className="tabular shrink-0 font-bold text-bad">
                    −{fmtMoney(a.amount)} ₺
                  </span>
                  <button
                    type="button"
                    onClick={() => setDelAlloc(a)}
                    aria-label="Sil"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Sponsor modal */}
      <Modal open={sponsorOpen} onClose={() => setSponsorOpen(false)} title="Sponsor Desteği Ekle">
        <form onSubmit={saveSponsor} className="space-y-4">
          <Field label="Sponsor / kurum">
            <input name="name" required maxLength={LIMITS.name} placeholder="örn. ETİ" className="field" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tutar (₺)">
              <input name="amount" type="number" min="0" step="any" required className="field" />
            </Field>
            <Field label="Tarih">
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="field"
              />
            </Field>
          </div>
          <Field label="Not" hint="Ayni destek, koşullar, iletişim kişisi…">
            <textarea name="note" rows={2} maxLength={LIMITS.shortText} className="field resize-y" />
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={() => setSponsorOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tahsis modal */}
      <Modal open={allocOpen} onClose={() => setAllocOpen(false)} title="Bütçe Tahsisi">
        <form onSubmit={saveAlloc} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Departman">
              <select name="dept" required defaultValue="" className="field">
                <option value="">Seçiniz…</option>
                {DEPT_KEYS.map((k) => (
                  <option key={k} value={k}>{DEPT_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Tutar (₺)">
              <input name="amount" type="number" min="0" step="any" required className="field" />
            </Field>
          </div>
          <Field label="Amaç" hint="Hangi kalem için harcanacak?">
            <textarea name="purpose" rows={2} maxLength={LIMITS.shortText} className="field resize-y" />
          </Field>
          <p className="rounded-lg border border-line bg-bg-2 px-3 py-2.5 text-[12.5px] text-ink-2">
            Kalan bütçe:{" "}
            <strong className="tabular text-ink">{fmtMoney(totals.remaining)} ₺</strong>
          </p>
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={() => setAllocOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!overspendConfirm}
        title="Bütçe aşımı"
        message={overspendConfirm?.message || ""}
        confirmLabel="Yine de kaydet"
        onConfirm={async () => {
          const p = overspendConfirm?.payload;
          setOverspendConfirm(null);
          if (p) await insertAllocation(p);
        }}
        onCancel={() => setOverspendConfirm(null)}
      />

      <ConfirmDialog
        open={!!delSponsor}
        message={`"${delSponsor?.name}" sponsor kaydı silinecek.`}
        onConfirm={doDeleteSponsor}
        onCancel={() => setDelSponsor(null)}
      />
      <ConfirmDialog
        open={!!delAlloc}
        message="Bu bütçe tahsisi silinecek."
        onConfirm={doDeleteAlloc}
        onCancel={() => setDelAlloc(null)}
      />
    </>
  );
}

function Tile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-1 p-5">
      <div className="flex items-center gap-2 text-ink-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div
        className={`display tabular mt-3 text-3xl ${
          tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
