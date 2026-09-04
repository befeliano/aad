"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Loader2,
  TriangleAlert,
  ListChecks,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reqText, trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

interface Item {
  id: string;
  label: string;
  hint: string | null;
  position: number;
  required: boolean;
}

export function ChecklistAyarlari() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Item | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("checklist_items")
      .select("*")
      .order("position");
    if (error) {
      setTableMissing(true);
      setItems([]);
    } else {
      setTableMissing(false);
      setItems((data as Item[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const label = reqText(fd.get("label"), LIMITS.shortText);
    if (!label) {
      toast("Madde metni zorunlu.", "error");
      return;
    }

    setSaving(true);
    const nextPos = items.length
      ? Math.max(...items.map((i) => i.position)) + 1
      : 1;
    const { data, error } = await supabase
      .from("checklist_items")
      .insert([
        {
          label,
          hint: trimTo(fd.get("hint"), LIMITS.shortText),
          required: fd.get("required") === "on",
          position: nextPos,
        },
      ])
      .select();
    setSaving(false);

    if (error) {
      toast("Eklenemedi: " + error.message, "error");
      return;
    }
    logAction(supabase, "create", "checklist_items", data?.[0]?.id ?? null, {
      label,
    });
    toast("Madde eklendi.");
    form.reset();
    load();
  }

  /** Alan güncelle — iyimser, hata olursa geri yükler */
  async function patch(item: Item, changes: Partial<Item>) {
    setItems((v) =>
      v.map((i) => (i.id === item.id ? { ...i, ...changes } : i))
    );
    const { error } = await supabase
      .from("checklist_items")
      .update(changes)
      .eq("id", item.id);
    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      load();
    }
  }

  /** Sırayı bir adım kaydır */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;

    const a = items[index];
    const b = items[target];
    const next = [...items];
    next[index] = { ...b, position: a.position };
    next[target] = { ...a, position: b.position };
    setItems(next.sort((x, y) => x.position - y.position));

    const { error } = await supabase.from("checklist_items").upsert([
      { id: a.id, position: b.position },
      { id: b.id, position: a.position },
    ]);
    if (error) {
      toast("Sıra değiştirilemedi: " + error.message, "error");
      load();
    }
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "checklist_items", delTarget.id, {
        label: delTarget.label,
      });
      toast("Madde silindi.");
    }
    setDelTarget(null);
    load();
  }

  const requiredCount = items.filter((i) => i.required).length;

  return (
    <>
      <PageHeader
        title="Uçuş Öncesi Kontrol Listesi"
        desc="Ekibin her uçuştan önce tek tek işaretleyeceği maddeler. Zorunlu maddeler işaretlenmeden uçuş başlatılamaz."
      />

      {tableMissing && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-4">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[13px] leading-relaxed text-ink-2">
            <strong className="text-ink">checklist_items tablosu bulunamadı.</strong>{" "}
            Supabase → SQL Editor&apos;da{" "}
            <code className="rounded bg-bg-3 px-1.5 py-0.5 text-[12px]">
              supabase/checklist.sql
            </code>{" "}
            dosyasındaki SQL&apos;i çalıştırın. O zamana kadar uçuş öncesi kontrol
            varsayılan listeyle çalışır.
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-bg-1 p-5">
          <div className="flex items-center gap-2 text-ink-3">
            <ListChecks size={18} />
            <span className="text-[12.5px] font-semibold">Toplam Madde</span>
          </div>
          <div className="display tabular mt-3 text-3xl text-ink">
            {items.length}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-bg-1 p-5">
          <div className="flex items-center gap-2 text-ink-3">
            <TriangleAlert size={18} />
            <span className="text-[12.5px] font-semibold">Zorunlu</span>
          </div>
          <div className="display tabular mt-3 text-3xl text-accent">
            {requiredCount}
          </div>
        </div>
      </div>

      {/* Yeni madde */}
      <Card title="Yeni Madde Ekle" className="mb-5">
        <form onSubmit={addItem} className="space-y-4 p-5">
          <Field label="Madde">
            <input
              name="label"
              required
              maxLength={LIMITS.shortText}
              placeholder="örn. Batarya şarj seviyeleri kontrol edildi"
              className="field"
            />
          </Field>
          <Field label="Açıklama" hint="Maddenin altında küçük yazıyla görünür">
            <input
              name="hint"
              maxLength={LIMITS.shortText}
              placeholder="örn. Uçuş ve verici bataryaları"
              className="field"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                name="required"
                defaultChecked
                className="size-4 accent-[var(--accent)]"
              />
              Zorunlu — işaretlenmeden uçuş başlatılamaz
            </label>
            <Button type="submit" disabled={saving || tableMissing}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Ekle
            </Button>
          </div>
        </form>
      </Card>

      {/* Mevcut maddeler */}
      <Card
        title="Maddeler"
        desc="Metne tıklayarak düzenleyebilir, oklarla sırayı değiştirebilirsiniz."
      >
        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">
            Yükleniyor…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={30} />}
            title="Henüz madde yok"
            desc={
              tableMissing
                ? "Önce SQL dosyasını çalıştırın."
                : "Yukarıdan ilk kontrol maddesini ekleyin."
            }
          />
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-start gap-3 px-5 py-4">
                <GripVertical
                  size={16}
                  className="mt-2 shrink-0 text-ink-3"
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    defaultValue={it.label}
                    maxLength={LIMITS.shortText}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== it.label) patch(it, { label: v });
                      else e.target.value = it.label;
                    }}
                    className="field !py-2 !text-[14px] !font-medium"
                    aria-label="Madde metni"
                  />
                  <input
                    defaultValue={it.hint || ""}
                    maxLength={LIMITS.shortText}
                    placeholder="Açıklama (isteğe bağlı)"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (it.hint || "")) patch(it, { hint: v || null });
                    }}
                    className="field !py-1.5 !text-[12.5px]"
                    aria-label="Açıklama"
                  />
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => patch(it, { required: !it.required })}
                    aria-pressed={it.required}
                    title={
                      it.required
                        ? "Zorunlu — tıklayarak isteğe bağlı yap"
                        : "İsteğe bağlı — tıklayarak zorunlu yap"
                    }
                  >
                    <Badge tone={it.required ? "warn" : "neutral"}>
                      {it.required ? "Zorunlu" : "İsteğe bağlı"}
                    </Badge>
                  </button>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Yukarı taşı"
                      className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label="Aşağı taşı"
                      className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelTarget(it)}
                      aria-label="Sil"
                      className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!delTarget}
        message={`"${delTarget?.label}" maddesi listeden silinecek.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}
