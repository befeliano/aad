"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, NotebookPen, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { reqText, trimTo, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Note, Flight } from "@/lib/types";
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

const NOTE_TYPES = ["observation", "issue", "improvement", "success"] as const;
type NoteType = (typeof NOTE_TYPES)[number];

const TYPE_META: Record<
  NoteType,
  { label: string; tone: "info" | "bad" | "warn" | "ok" }
> = {
  observation: { label: "Gözlem", tone: "info" },
  issue: { label: "Sorun", tone: "bad" },
  improvement: { label: "İyileştirme", tone: "warn" },
  success: { label: "Başarı", tone: "ok" },
};

const SEVERITIES = ["low", "medium", "high"] as const;
const SEV_LABEL: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

export function NotlarClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Note | null>(null);

  const load = useCallback(async () => {
    const [n, f] = await Promise.all([
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("flights")
        .select("*")
        .order("flight_date", { ascending: false }),
    ]);
    if (n.error) toast("Notlar yüklenemedi: " + n.error.message, "error");
    else setNotes((n.data as Note[]) || []);
    if (!f.error) setFlights((f.data as Flight[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:notes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const flightLabel = useCallback(
    (id: string | null) => {
      if (!id) return "Bağımsız not";
      const f = flights.find((x) => x.id === id);
      return f
        ? `${f.aircraft} · ${fmtDate(f.flight_date)} ${fmtTime(f.flight_time)}`
        : "Silinmiş uçuş";
    },
    [flights]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return notes.filter((n) => {
      if (type && n.note_type !== type) return false;
      if (needle && !n.text.toLocaleLowerCase("tr").includes(needle)) return false;
      return true;
    });
  }, [notes, q, type]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    notes.forEach((n) => {
      c[n.note_type] = (c[n.note_type] || 0) + 1;
    });
    return c;
  }, [notes]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = reqText(fd.get("text"), LIMITS.longText);
    if (!text) {
      toast("Not metni zorunlu.", "error");
      return;
    }
    const payload = {
      flight_id: trimTo(fd.get("flight_id"), 64),
      note_type: oneOf(fd.get("note_type"), NOTE_TYPES, "observation"),
      severity: oneOf(fd.get("severity"), SEVERITIES, "medium"),
      text,
      created_by: userId,
    };

    setSaving(true);
    const { data, error } = await supabase.from("notes").insert([payload]).select();
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(supabase, "create", "notes", data?.[0]?.id ?? null, {
      type: payload.note_type,
    });
    toast("Not kaydedildi.");
    setFormOpen(false);
    load();
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase.from("notes").delete().eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "notes", delTarget.id, {});
      toast("Not silindi.");
    }
    setDelTarget(null);
    load();
  }

  return (
    <>
      <PageHeader
        title="Uçuş Notları"
        desc="Test uçuşlarından çıkan gözlem, sorun ve iyileştirme kayıtları. Her uçuş bir sonraki tasarımı besler."
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} />
          Not Ekle
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NOTE_TYPES.map((t) => (
          <div key={t} className="rounded-2xl border border-line bg-bg-1 p-5">
            <div className="flex items-center gap-2">
              <Badge tone={TYPE_META[t].tone}>{TYPE_META[t].label}</Badge>
            </div>
            <div className="display tabular mt-3 text-3xl text-ink">
              {counts[t] || 0}
            </div>
          </div>
        ))}
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
              placeholder="Not içinde ara…"
              className="field !pl-9"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm türler</option>
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-ink-3">{filtered.length} not</span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<NotebookPen size={30} />}
            title={notes.length === 0 ? "Henüz not yok" : "Sonuç bulunamadı"}
            desc={
              notes.length === 0
                ? "Uçuş sonrası gözlemlerinizi buraya yazın; kurumsal hafıza böyle oluşur."
                : "Filtreleri değiştirmeyi deneyin."
            }
            action={
              notes.length === 0 ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus size={16} />
                  Not Ekle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((n) => {
              const meta = TYPE_META[n.note_type as NoteType] ?? TYPE_META.observation;
              return (
                <article
                  key={n.id}
                  className="flex flex-col rounded-xl border border-line bg-bg p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-[11.5px] text-ink-3">
                      {fmtDateTime(n.created_at)}
                    </span>
                  </div>

                  <p className="mt-3 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                    {n.text}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-ink-3">
                      <Plane size={12} className="shrink-0" />
                      <span className="truncate">{flightLabel(n.flight_id)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDelTarget(n)}
                      aria-label="Sil"
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Yeni Uçuş Notu">
        <form onSubmit={save} className="space-y-4">
          <Field label="İlgili uçuş" hint="Boş bırakırsanız bağımsız not olur">
            <select name="flight_id" defaultValue="" className="field">
              <option value="">— Bağımsız not —</option>
              {flights.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.aircraft} · {fmtDate(f.flight_date)} {fmtTime(f.flight_time)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Not türü">
              <select name="note_type" defaultValue="observation" className="field">
                {NOTE_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Önem">
              <select name="severity" defaultValue="medium" className="field">
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{SEV_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Not">
            <textarea
              name="text"
              rows={5}
              required
              maxLength={LIMITS.longText}
              placeholder="Ne gözlemlendi? Ne oldu? Ne yapılmalı?"
              className="field resize-y"
            />
          </Field>

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        message="Bu not silinecek. Bu işlem geri alınamaz."
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}
