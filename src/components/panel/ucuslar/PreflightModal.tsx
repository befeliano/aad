"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Rocket, TriangleAlert, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtTime } from "@/lib/format";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Flight } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Badge, Button, Field, Modal } from "@/components/ui/Kit";

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string | null;
  position: number;
  required: boolean;
}

/** checklist_items tablosu yoksa kullanılacak yedek liste */
const FALLBACK_ITEMS: ChecklistItem[] = [
  { id: "f1", label: "Batarya şarj seviyeleri kontrol edildi", hint: "Uçuş ve verici bataryaları", position: 1, required: true },
  { id: "f2", label: "Pervaneler sıkı ve hasarsız", hint: "Çatlak/çentik kontrolü", position: 2, required: true },
  { id: "f3", label: "Kontrol yüzeyleri serbest ve doğru yönde", hint: "Aileron, elevator, rudder", position: 3, required: true },
  { id: "f4", label: "Kumanda bağlantısı ve failsafe testi", hint: "Menzil testi yapıldı", position: 4, required: true },
  { id: "f5", label: "Telemetri ve yer istasyonu bağlantısı", hint: null, position: 5, required: true },
  { id: "f6", label: "GPS fix alındı (min. 8 uydu)", hint: null, position: 6, required: true },
  { id: "f7", label: "Ağırlık merkezi (CG) doğrulandı", hint: null, position: 7, required: true },
  { id: "f8", label: "Uçuş alanı ve hava durumu uygun", hint: "Rüzgâr, yağış, görüş", position: 8, required: true },
];

/**
 * Uçuş öncesi kontrol listesi.
 * Maddeler kaptanın tanımladığı `checklist_items` tablosundan gelir;
 * tablo henüz oluşturulmadıysa yedek listeye düşer ve kaydetme kapanır.
 */
export function PreflightModal({
  flight,
  open,
  onClose,
  onStarted,
}: {
  flight: Flight | null;
  open: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("checklist_items")
      .select("*")
      .order("position");

    if (error) {
      // Tablo yoksa yedek listeyi göster, kaydetmeyi kapat
      setItems(FALLBACK_ITEMS);
      setTableMissing(true);
    } else {
      setItems(((data as ChecklistItem[]) || []).length ? (data as ChecklistItem[]) : FALLBACK_ITEMS);
      setTableMissing(false);
    }
    setTicked({});
    setNote("");
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [open, load]);

  const requiredItems = items.filter((i) => i.required);
  const doneRequired = requiredItems.filter((i) => ticked[i.id]).length;
  const allRequiredDone = doneRequired === requiredItems.length;
  const doneAll = items.filter((i) => ticked[i.id]).length;
  const pct = items.length ? Math.round((doneAll / items.length) * 100) : 0;

  async function startFlight() {
    if (!flight) return;
    if (!allRequiredDone) {
      toast("Zorunlu maddelerin tamamı işaretlenmeli.", "error");
      return;
    }
    if (tableMissing) {
      toast(
        "Checklist tabloları yok — kayıt yapılamıyor. supabase/checklist.sql dosyasını çalıştırın.",
        "error"
      );
      return;
    }

    setSaving(true);
    const payload = {
      flight_id: flight.id,
      checked: items.map((i) => ({
        label: i.label,
        ok: !!ticked[i.id],
        required: i.required,
      })),
      note: trimTo(note, LIMITS.shortText),
      started_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("flight_checklists")
      .upsert([payload], { onConflict: "flight_id" });
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(supabase, "create", "flight_checklists", flight.id, {
      aircraft: flight.aircraft,
      items: items.length,
    });
    toast(`${flight.aircraft} uçuşu başlatıldı. İyi uçuşlar!`);
    onStarted();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        flight
          ? `Uçuş Öncesi Kontrol — ${flight.aircraft}`
          : "Uçuş Öncesi Kontrol"
      }
    >
      {flight && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg-2 px-4 py-3">
          <Badge tone="accent">{fmtDate(flight.flight_date)}</Badge>
          <Badge tone="info">{fmtTime(flight.flight_time)}</Badge>
          {flight.pilot && <Badge tone="neutral">Pilot: {flight.pilot}</Badge>}
          {flight.location && <Badge tone="neutral">{flight.location}</Badge>}
        </div>
      )}

      {tableMissing && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-4">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[13px] leading-relaxed text-ink-2">
            Checklist tabloları henüz oluşturulmamış. Aşağıdaki liste
            varsayılan şablondur; işaretleyebilirsiniz ama{" "}
            <strong className="text-ink">kaydedilemez</strong>. Kalıcı hale
            getirmek için{" "}
            <code className="rounded bg-bg-3 px-1.5 py-0.5 text-[12px]">
              supabase/checklist.sql
            </code>{" "}
            dosyasını Supabase SQL Editor&apos;da çalıştırın.
          </p>
        </div>
      )}

      {/* İlerleme */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-ink">
            {doneAll} / {items.length} madde
          </span>
          <span
            className={`tabular text-[13px] font-bold ${
              allRequiredDone ? "text-ok" : "text-ink-3"
            }`}
          >
            Zorunlu: {doneRequired}/{requiredItems.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-3">
          <div
            className={`h-full rounded-full transition-all ${
              allRequiredDone ? "bg-ok" : "bg-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-3">Yükleniyor…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const on = !!ticked[it.id];
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() =>
                    setTicked((v) => ({ ...v, [it.id]: !v[it.id] }))
                  }
                  aria-pressed={on}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    on
                      ? "border-ok/40 bg-ok/8"
                      : "border-line bg-bg hover:border-line-2"
                  }`}
                >
                  {on ? (
                    <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-ok" />
                  ) : (
                    <Circle size={19} className="mt-0.5 shrink-0 text-ink-3" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[14px] font-medium ${
                        on ? "text-ink" : "text-ink-2"
                      }`}
                    >
                      {it.label}
                    </span>
                    {it.hint && (
                      <span className="mt-0.5 block text-[12px] text-ink-3">
                        {it.hint}
                      </span>
                    )}
                  </span>
                  {it.required && (
                    <Badge tone={on ? "ok" : "warn"}>Zorunlu</Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5">
        <Field label="Uçuş öncesi not" hint="İsteğe bağlı">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={LIMITS.shortText}
            placeholder="Rüzgâr 12 km/s kuzeybatı, pist ıslak…"
            className="field resize-y"
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-line pt-5">
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          onClick={startFlight}
          disabled={!allRequiredDone || saving || loading}
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Rocket size={16} />
          )}
          {saving ? "Kaydediliyor…" : "Uçuşu Başlat"}
        </Button>
      </div>
    </Modal>
  );
}
