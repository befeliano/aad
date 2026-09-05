"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDateTime } from "@/lib/format";
import { Badge, EmptyState, Modal } from "@/components/ui/Kit";
import { DURUM_ETIKET, type Durum } from "./PreflightModal";
import type { Flight } from "@/lib/types";

/** Kaydedilmiş satır. Eski kayıtlarda `durum` yerine `ok: boolean` var. */
interface KayitliMadde {
  label: string;
  hint?: string | null;
  section?: string | null;
  durum?: Durum;
  ok?: boolean;
  required?: boolean;
}

/**
 * Geçmiş bir uçuşun doldurulmuş kontrol listesi.
 *
 * Kayıt o anki hâliyle saklanıyor: şablon sonradan değişse bile bu uçuşun
 * formu değişmez. Şablona sonradan eklenen maddeler geçmiş uçuşlarda
 * görünmez — bilerek böyle.
 */
export function ChecklistGecmisi({
  flight,
  open,
  onClose,
}: {
  flight: Flight | null;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [maddeler, setMaddeler] = useState<KayitliMadde[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [zaman, setZaman] = useState<{ bas: string | null; bit: string | null }>({
    bas: null,
    bit: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!flight) return;
    setLoading(true);
    const { data } = await supabase
      .from("flight_checklists")
      .select("checked, note, started_at, completed_at")
      .eq("flight_id", flight.id)
      .maybeSingle();

    const row = data as {
      checked: KayitliMadde[] | null;
      note: string | null;
      started_at: string | null;
      completed_at: string | null;
    } | null;

    setMaddeler(row?.checked ?? []);
    setNote(row?.note ?? null);
    setZaman({ bas: row?.started_at ?? null, bit: row?.completed_at ?? null });
    setLoading(false);
  }, [supabase, flight]);

  useEffect(() => {
    if (!open) return;
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [open, load]);

  /** Eski kayıtlarda durum yok — ok alanından türet */
  const durumOf = (m: KayitliMadde): Durum =>
    m.durum ?? (m.ok ? "gecti" : "na");

  const bolumler = useMemo(() => {
    const g = new Map<string, KayitliMadde[]>();
    for (const m of maddeler) {
      const k = (m.section || "").trim() || "Kontrol Listesi";
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(m);
    }
    return [...g.entries()];
  }, [maddeler]);

  const sayim = useMemo(() => {
    const c = { gecti: 0, kaldi: 0, na: 0 };
    for (const m of maddeler) c[durumOf(m)]++;
    return c;
  }, [maddeler]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Kontrol Listesi · ${flight?.aircraft ?? ""}`}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-3">
          <Loader2 size={16} className="animate-spin" />
          Yükleniyor…
        </div>
      ) : maddeler.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title="Bu uçuş için kayıtlı form yok"
          desc="Uçuş, kontrol listesi doldurulmadan başlatılmış olabilir."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-4 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <b className="tabular text-ok">{sayim.gecti}</b> geçti
            </span>
            <span className="inline-flex items-center gap-1.5">
              <b className="tabular text-bad">{sayim.kaldi}</b> kaldı
            </span>
            <span className="inline-flex items-center gap-1.5">
              <b className="tabular text-ink-2">{sayim.na}</b> N/A
            </span>
            {zaman.bas && <span>Başlangıç: {fmtDateTime(zaman.bas)}</span>}
            {zaman.bit && <span>Bitiş: {fmtDateTime(zaman.bit)}</span>}
          </div>

          <div className="space-y-6">
            {bolumler.map(([bolum, liste]) => (
              <section key={bolum}>
                <h4 className="mb-2 border-b border-line pb-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  {bolum}
                </h4>
                <ul className="divide-y divide-line">
                  {liste.map((m, i) => {
                    const d = durumOf(m);
                    return (
                      <li
                        key={`${m.label}-${i}`}
                        className="flex items-start gap-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] text-ink">
                            {m.label}
                          </span>
                          {m.hint && (
                            <span className="mt-0.5 block text-[12px] text-ink-3">
                              {m.hint}
                            </span>
                          )}
                        </span>
                        <Badge
                          tone={
                            d === "gecti" ? "ok" : d === "kaldi" ? "bad" : "neutral"
                          }
                        >
                          {DURUM_ETIKET[d]}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {note && (
            <div className="mt-6 rounded-xl border border-line bg-bg-2 p-4">
              <div className="eyebrow mb-1.5 !text-[10px]">Uçuş öncesi not</div>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{note}</p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
