"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Pencil,
  Check,
  RotateCcw,
  ClipboardList,
  TriangleAlert,
  Wallet,
  CircleCheck,
} from "lucide-react";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { fmtMoney, fmtDate, toCSV, downloadFile } from "@/lib/format";
import { reqText, trimTo, safeNumber, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Need, Priority } from "@/lib/types";
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

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const PRIO_META: Record<
  Priority,
  { label: string; tone: "bad" | "warn" | "info" | "ok"; order: number }
> = {
  critical: { label: "Kritik", tone: "bad", order: 0 },
  high: { label: "Yüksek", tone: "warn", order: 1 },
  medium: { label: "Orta", tone: "info", order: 2 },
  low: { label: "Düşük", tone: "ok", order: 3 },
};

export function IhtiyaclarClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useKaliciFiltre("ihtiyaclar.q", "");
  const [dept, setDept] = useKaliciFiltre("ihtiyaclar.dept", "");
  const [showDone, setShowDone] = useKaliciFiltre("ihtiyaclar.showDone", false);

  const [editing, setEditing] = useState<Need | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Need | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("needs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast("İhtiyaçlar yüklenemedi: " + error.message, "error");
    else setItems((data as Need[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:needs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "needs" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return items
      .filter((n) => {
        if (!showDone && n.done) return false;
        if (dept && n.dept !== dept) return false;
        if (
          needle &&
          !`${n.item} ${n.reason || ""} ${DEPT_LABELS[n.dept] || n.dept}`
            .toLocaleLowerCase("tr")
            .includes(needle)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (
          (PRIO_META[a.priority]?.order ?? 9) -
          (PRIO_META[b.priority]?.order ?? 9)
        );
      });
  }, [items, q, dept, showDone]);

  const summary = useMemo(() => {
    const open = items.filter((n) => !n.done);
    return {
      open: open.length,
      critical: open.filter((n) => n.priority === "critical").length,
      done: items.filter((n) => n.done).length,
      cost: open.reduce((a, n) => a + Number(n.cost || 0) * Number(n.qty || 1), 0),
    };
  }, [items]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const item = reqText(fd.get("item"), LIMITS.name);
    if (!item) {
      toast("İhtiyaç adı zorunlu.", "error");
      return;
    }
    const payload = {
      item,
      dept: oneOf(fd.get("dept"), DEPT_KEYS, "ortak"),
      qty: safeNumber(fd.get("qty"), { min: 0, max: 1e6, fallback: 1 }),
      cost: safeNumber(fd.get("cost"), { min: 0, max: 1e9 }),
      priority: oneOf(fd.get("priority"), PRIORITIES, "medium"),
      reason: trimTo(fd.get("reason"), LIMITS.shortText),
    };

    setSaving(true);
    const { data, error } = editing
      ? await supabase
          .from("needs")
          .update(payload)
          .eq("id", editing.id)
          .select()
      : await supabase
          .from("needs")
          .insert([{ ...payload, created_by: userId, done: false }])
          .select();
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(
      supabase,
      editing ? "update" : "create",
      "needs",
      data?.[0]?.id ?? editing?.id ?? null,
      { item: payload.item }
    );
    toast(editing ? "Talep güncellendi." : "Talep oluşturuldu.");
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function toggleDone(n: Need) {
    setItems((v) =>
      v.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x))
    );
    const { error } = await supabase
      .from("needs")
      .update({ done: !n.done })
      .eq("id", n.id);
    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      load();
    } else {
      logAction(supabase, "update", "needs", n.id, { done: !n.done });
    }
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("needs")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "needs", delTarget.id, {
        item: delTarget.item,
      });
      toast("Talep silindi.");
    }
    setDelTarget(null);
    load();
  }

  function exportCSV() {
    const rows = filtered.map((n) => [
      n.item,
      DEPT_LABELS[n.dept] || n.dept,
      n.qty,
      n.cost ?? 0,
      Number(n.cost || 0) * Number(n.qty || 1),
      PRIO_META[n.priority]?.label ?? n.priority,
      n.done ? "Tamamlandı" : "Açık",
      n.reason || "",
      fmtDate(n.created_at),
    ]);
    downloadFile(
      toCSV(
        [
          "İhtiyaç",
          "Departman",
          "Adet",
          "Birim Maliyet",
          "Toplam",
          "Öncelik",
          "Durum",
          "Gerekçe",
          "Tarih",
        ],
        rows
      ),
      `ihtiyaclar-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`${rows.length} talep dışa aktarıldı.`);
  }

  return (
    <>
      <PageHeader
        title="İhtiyaç Tablosu"
        desc="Departmanların malzeme ve ekipman talepleri. Sponsorluk ekibi bu listeye göre tedarik planlar."
      >
        <Button variant="outline" size="md" onClick={exportCSV}>
          <Download size={15} />
          CSV indir
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          İhtiyaç Bildir
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={<ClipboardList size={18} />} label="Açık Talep" value={String(summary.open)} />
        <Tile
          icon={<TriangleAlert size={18} />}
          label="Kritik"
          value={String(summary.critical)}
          tone={summary.critical > 0 ? "bad" : undefined}
        />
        <Tile icon={<Wallet size={18} />} label="Tahmini Bütçe" value={`${fmtMoney(summary.cost)} ₺`} />
        <Tile icon={<CircleCheck size={18} />} label="Tamamlanan" value={String(summary.done)} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="İhtiyaç veya gerekçe ara…"
              className="field !pl-9"
            />
          </div>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm departmanlar</option>
            {DEPT_KEYS.map((k) => (
              <option key={k} value={k}>
                {DEPT_LABELS[k]}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Tamamlananları göster
          </label>
          <span className="ml-auto text-xs text-ink-3">
            {filtered.length} kayıt
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={30} />}
            title={items.length === 0 ? "Henüz talep yok" : "Sonuç bulunamadı"}
            desc={
              items.length === 0
                ? "İhtiyacınız olan malzemeyi bildirin, sponsorluk ekibi görsün."
                : "Filtreleri değiştirmeyi deneyin."
            }
            action={
              items.length === 0 ? (
                <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus size={16} />
                  İhtiyaç Bildir
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["İhtiyaç", "Departman", "Adet", "Tahmini Tutar", "Öncelik", "Durum", ""].map(
                    (h, i) => (
                      <th
                        key={h + i}
                        className={`px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3 ${
                          ["Adet", "Tahmini Tutar"].includes(h) ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const prio = PRIO_META[n.priority] ?? PRIO_META.medium;
                  const total = Number(n.cost || 0) * Number(n.qty || 1);
                  return (
                    <tr
                      key={n.id}
                      className={`border-b border-line last:border-0 transition-colors hover:bg-bg-2/60 ${
                        n.done ? "opacity-55" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div
                          className={`font-semibold text-ink ${
                            n.done ? "line-through" : ""
                          }`}
                        >
                          {n.item}
                        </div>
                        {n.reason && (
                          <div className="mt-0.5 max-w-md text-[12.5px] text-ink-3">
                            {n.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="info">{DEPT_LABELS[n.dept] || n.dept}</Badge>
                      </td>
                      <td className="tabular px-4 py-3 text-right text-ink">{n.qty}</td>
                      <td className="tabular px-4 py-3 text-right font-semibold text-ink">
                        {total ? `${fmtMoney(total)} ₺` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={prio.tone}>{prio.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={n.done ? "ok" : "accent"}>
                          {n.done ? "Tamamlandı" : "Açık"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => toggleDone(n)}
                            title={n.done ? "Yeniden aç" : "Tamamlandı işaretle"}
                            aria-label={n.done ? "Yeniden aç" : "Tamamlandı işaretle"}
                            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-ok/12 hover:text-ok"
                          >
                            {n.done ? <RotateCcw size={14} /> : <Check size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditing(n); setFormOpen(true); }}
                            aria-label="Düzenle"
                            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDelTarget(n)}
                            aria-label="Sil"
                            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        title={editing ? "Talebi Düzenle" : "Yeni İhtiyaç"}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="İhtiyaç">
            <input
              name="item"
              required
              maxLength={LIMITS.name}
              defaultValue={editing?.item || ""}
              placeholder="örn. Pixhawk 6C uçuş kontrol kartı"
              className="field"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Departman">
              <select name="dept" defaultValue={editing?.dept || ""} className="field" required>
                <option value="">Seçiniz…</option>
                {DEPT_KEYS.map((k) => (
                  <option key={k} value={k}>{DEPT_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Adet">
              <input
                name="qty"
                type="number"
                min="0"
                step="any"
                defaultValue={editing?.qty ?? 1}
                className="field"
              />
            </Field>
            <Field label="Öncelik">
              <select name="priority" defaultValue={editing?.priority || "medium"} className="field">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIO_META[p].label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Birim maliyet (₺)" hint="Tahmini — boş bırakabilirsiniz">
            <input
              name="cost"
              type="number"
              min="0"
              step="any"
              defaultValue={editing?.cost ?? ""}
              className="field"
            />
          </Field>

          <Field label="Gerekçe">
            <textarea
              name="reason"
              rows={3}
              maxLength={LIMITS.shortText}
              defaultValue={editing?.reason || ""}
              placeholder="Neden gerekli, hangi işte kullanılacak?"
              className="field resize-y"
            />
          </Field>

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        message={`"${delTarget?.item}" talebi silinecek. Bu işlem geri alınamaz.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
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
  tone?: "bad";
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-1 p-5">
      <div className="flex items-center gap-2 text-ink-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div
        className={`display tabular mt-3 text-3xl ${
          tone === "bad" ? "text-bad" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
