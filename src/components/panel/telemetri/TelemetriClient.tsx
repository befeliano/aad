"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Radio, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { reqText, trimTo, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Telemetry, Flight } from "@/lib/types";
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

const CATEGORIES = ["endpoint", "log", "dashboard", "docs"] as const;
const CAT_META: Record<
  string,
  { label: string; tone: "info" | "warn" | "ok" | "neutral" }
> = {
  endpoint: { label: "API Endpoint", tone: "info" },
  log: { label: "Telemetri Log", tone: "warn" },
  dashboard: { label: "Dashboard", tone: "ok" },
  docs: { label: "Doküman", tone: "neutral" },
};

export function TelemetriClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<Telemetry[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Telemetry | null>(null);

  const load = useCallback(async () => {
    const [t, f] = await Promise.all([
      supabase.from("telemetry").select("*").order("created_at", { ascending: false }),
      supabase.from("flights").select("*").order("flight_date", { ascending: false }),
    ]);
    if (t.error) toast("Kayıtlar yüklenemedi: " + t.error.message, "error");
    else setItems((t.data as Telemetry[]) || []);
    if (!f.error) setFlights((f.data as Flight[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:telemetry")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "telemetry" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return items.filter((t) => {
      if (cat && t.category !== cat) return false;
      if (
        needle &&
        !`${t.title} ${t.payload || ""}`.toLocaleLowerCase("tr").includes(needle)
      )
        return false;
      return true;
    });
  }, [items, q, cat]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = reqText(fd.get("title"), LIMITS.title);
    if (!title) {
      toast("Başlık zorunlu.", "error");
      return;
    }
    const payload = {
      title,
      category: oneOf(fd.get("category"), CATEGORIES, "endpoint"),
      payload: trimTo(fd.get("payload"), LIMITS.payload),
      flight_id: trimTo(fd.get("flight_id"), 64),
      created_by: userId,
    };

    setSaving(true);
    const { data, error } = await supabase.from("telemetry").insert([payload]).select();
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(supabase, "create", "telemetry", data?.[0]?.id ?? null, {
      title: payload.title,
    });
    toast("Kayıt eklendi.");
    setFormOpen(false);
    load();
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase.from("telemetry").delete().eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "telemetry", delTarget.id, {});
      toast("Kayıt silindi.");
    }
    setDelTarget(null);
    load();
  }

  async function copyPayload(t: Telemetry) {
    if (!t.payload) return;
    try {
      await navigator.clipboard.writeText(t.payload);
      setCopied(t.id);
      setTimeout(() => setCopied((c) => (c === t.id ? null : c)), 1800);
    } catch {
      toast("Kopyalanamadı.", "error");
    }
  }

  const flightLabel = (id: string | null) => {
    if (!id) return "Bağımsız";
    const f = flights.find((x) => x.id === id);
    return f ? `${f.aircraft} · ${fmtDate(f.flight_date)}` : "Silinmiş uçuş";
  };

  return (
    <>
      <PageHeader
        title="API & Telemetri"
        desc="Endpoint adresleri, telemetri log örnekleri, dashboard bağlantıları ve teknik dokümanlar."
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} />
          Kayıt Ekle
        </Button>
      </PageHeader>

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
              placeholder="Başlık veya içerik ara…"
              className="field !pl-9"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm kategoriler</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CAT_META[c].label}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-ink-3">{filtered.length} kayıt</span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Radio size={30} />}
            title={items.length === 0 ? "Henüz kayıt yok" : "Sonuç bulunamadı"}
            desc={
              items.length === 0
                ? "API endpoint'leri ve telemetri örneklerini buraya kaydedin."
                : "Filtreleri değiştirmeyi deneyin."
            }
            action={
              items.length === 0 ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus size={16} />
                  Kayıt Ekle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {filtered.map((t) => {
              const meta = CAT_META[t.category] ?? CAT_META.endpoint;
              return (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-ink">{t.title}</span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="ml-auto flex items-center gap-1">
                      {t.payload && (
                        <button
                          type="button"
                          onClick={() => copyPayload(t)}
                          aria-label="İçeriği kopyala"
                          title="İçeriği kopyala"
                          className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                        >
                          {copied === t.id ? (
                            <Check size={14} className="text-ok" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDelTarget(t)}
                        aria-label="Sil"
                        className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>

                  {t.payload && (
                    <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-line bg-bg-2 p-3 text-[12px] leading-relaxed text-ink-2">
                      {t.payload}
                    </pre>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-x-4 text-[12px] text-ink-3">
                    <span>✈ {flightLabel(t.flight_id)}</span>
                    <span>{fmtDateTime(t.created_at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Yeni Kayıt">
        <form onSubmit={save} className="space-y-4">
          <Field label="Başlık">
            <input
              name="title"
              required
              maxLength={LIMITS.title}
              placeholder="örn. POST /api/telemetri_gonder"
              className="field"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategori">
              <select name="category" defaultValue="endpoint" className="field">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CAT_META[c].label}</option>
                ))}
              </select>
            </Field>
            <Field label="İlgili uçuş">
              <select name="flight_id" defaultValue="" className="field">
                <option value="">— Bağımsız —</option>
                {flights.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.aircraft} · {fmtDate(f.flight_date)} {fmtTime(f.flight_time)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="İçerik" hint="JSON örneği, endpoint adresi, log parçası…">
            <textarea
              name="payload"
              rows={7}
              maxLength={LIMITS.payload}
              placeholder={'{\n  "takim_numarasi": 1,\n  "iha_enlem": 39.8198\n}'}
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
        message={`"${delTarget?.title}" kaydı silinecek.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}
