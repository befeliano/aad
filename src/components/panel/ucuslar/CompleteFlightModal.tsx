"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Timer,
  Route,
  Mountain,
  Gauge,
  Upload,
  Loader2,
  FlagTriangleRight,
  Database,
  TriangleAlert,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseFlightDb, type FlightSession } from "@/lib/flight-db";
import { safeExt, safeFileName, trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { fmtDuration } from "@/lib/format";
import type { Flight } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Badge, Button, Field, Modal } from "@/components/ui/Kit";
import { useElapsed, formatElapsed } from "./useElapsed";

export interface ActiveSession {
  flight: Flight;
  startedAt: string;
}

const MAX_LOG_MB = 200;

export function CompleteFlightModal({
  session,
  open,
  onClose,
  onCompleted,
}: {
  session: ActiveSession | null;
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const elapsed = useElapsed(open && session ? session.startedAt : null);

  const [note, setNote] = useState("");
  const [logFile, setLogFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<FlightSession | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** .db seçilince tarayıcıda çözümleyip istatistikleri çıkar */
  const pickLog = useCallback(
    async (file: File) => {
      setLogFile(file);
      setAnalysis(null);
      setAnalyzeError(null);

      if (file.size > MAX_LOG_MB * 1048576) {
        setAnalyzeError(`Dosya çok büyük (max ${MAX_LOG_MB} MB).`);
        return;
      }
      // .db-wal tek başına çözümlenemez; sadece .db okunur
      if (!/\.(db|sqlite|sqlite3)$/i.test(file.name)) {
        setAnalyzeError(
          "Analiz için .db dosyası gerekir. Dosya yine de kaydedilecek."
        );
        return;
      }

      setAnalyzing(true);
      try {
        setAnalysis(await parseFlightDb(file));
      } catch (ex) {
        setAnalyzeError((ex as Error).message);
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  async function complete() {
    if (!session) return;
    setSaving(true);

    const durationSec = Math.round(elapsed);
    const durationMin = Math.max(1, Math.round(durationSec / 60));

    /* 1) Uçuş kaydı dosyasını yükle (varsa) */
    let logPath: string | null = null;
    if (logFile) {
      const ext = safeExt(logFile.name);
      const path = `flights/${session.flight.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("flight-logs")
        .upload(path, logFile, { upsert: false });
      if (upErr) {
        setSaving(false);
        toast(
          "Uçuş kaydı yüklenemedi: " +
            upErr.message +
            " (supabase/flight-session.sql çalıştırıldı mı?)",
          "error"
        );
        return;
      }
      logPath = path;
    }

    /* 2) Checklist kaydını tamamla */
    const stats = analysis
      ? {
          duration_s: durationSec,
          distance_km: +analysis.stats.distanceKm.toFixed(3),
          max_alt: +analysis.stats.maxAlt.toFixed(1),
          max_speed: +analysis.stats.maxSpeed.toFixed(1),
          avg_speed: +analysis.stats.avgSpeed.toFixed(1),
          telemetry_rows: analysis.stats.telemetryRows,
          log_name: logFile ? safeFileName(logFile.name) : null,
        }
      : { duration_s: durationSec, log_name: logFile ? safeFileName(logFile.name) : null };

    const { error: clErr } = await supabase
      .from("flight_checklists")
      .update({
        ended_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        flight_note: trimTo(note, LIMITS.longText),
        log_path: logPath,
        stats,
      })
      .eq("flight_id", session.flight.id);

    if (clErr) {
      setSaving(false);
      toast("Tamamlanamadı: " + clErr.message, "error");
      return;
    }

    /* 3) Uçuş süresini flights tablosuna yaz */
    await supabase
      .from("flights")
      .update({ duration: durationMin })
      .eq("id", session.flight.id);

    /* 4) Not girildiyse uçuş notu olarak da kaydet */
    const trimmed = trimTo(note, LIMITS.longText);
    if (trimmed) {
      await supabase.from("notes").insert([
        {
          flight_id: session.flight.id,
          note_type: "observation",
          severity: "medium",
          text: trimmed,
        },
      ]);
    }

    logAction(supabase, "update", "flight_checklists", session.flight.id, {
      aircraft: session.flight.aircraft,
      duration_min: durationMin,
      has_log: !!logPath,
    });

    setSaving(false);
    toast(`Uçuş tamamlandı — ${formatElapsed(durationSec)}`);
    setNote("");
    setLogFile(null);
    setAnalysis(null);
    onCompleted();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} wide title="Uçuşu Tamamla">
      {session && (
        <>
          {/* Süre */}
          <div className="rounded-2xl border border-line bg-bg-2 p-6 text-center">
            <div className="eyebrow mb-2">{session.flight.aircraft} · uçuş süresi</div>
            <div className="display tabular text-6xl text-ink">
              {formatElapsed(elapsed)}
            </div>
            <div className="mt-2 text-[12.5px] text-ink-3">
              Başlangıç:{" "}
              {new Date(session.startedAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          {/* Uçuş kaydı */}
          <div className="mt-6">
            <div className="eyebrow mb-2">Uçuş kaydı (isteğe bağlı)</div>

            {!logFile ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-2 bg-bg-1 px-5 py-8 text-center transition-colors hover:border-accent">
                <Database size={24} className="text-ink-3" />
                <span className="mt-3 text-sm font-semibold text-ink">
                  .db uçuş kaydını seçin
                </span>
                <span className="mt-1 text-[12.5px] text-ink-3">
                  Yüklenince mesafe ve telemetri özeti otomatik çıkarılır
                </span>
                <input
                  type="file"
                  accept=".db,.sqlite,.sqlite3,.db-wal"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickLog(f);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <div className="rounded-xl border border-line bg-bg-1 p-4">
                <div className="flex items-center gap-2.5">
                  <Database size={17} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                    {logFile.name}
                  </span>
                  <span className="tabular shrink-0 text-[12px] text-ink-3">
                    {(logFile.size / 1048576).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLogFile(null);
                      setAnalysis(null);
                      setAnalyzeError(null);
                    }}
                    aria-label="Kaldır"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-bg-2 hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>

                {analyzing && (
                  <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
                    <Loader2 size={14} className="animate-spin" />
                    Telemetri çözümleniyor…
                  </p>
                )}

                {analyzeError && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-[12.5px] leading-relaxed text-warn">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                    {analyzeError}
                  </p>
                )}

                {analysis && (
                  <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
                    <Stat
                      icon={<Route size={13} />}
                      label="Kat edilen"
                      value={`${analysis.stats.distanceKm.toFixed(2)} km`}
                      hint={`${Math.round(analysis.stats.distanceKm * 1000).toLocaleString("tr-TR")} m`}
                    />
                    <Stat
                      icon={<Mountain size={13} />}
                      label="Maks. irtifa"
                      value={`${analysis.stats.maxAlt.toFixed(0)} m`}
                    />
                    <Stat
                      icon={<Gauge size={13} />}
                      label="Maks. hız"
                      value={`${analysis.stats.maxSpeed.toFixed(1)} m/s`}
                    />
                    <Stat
                      icon={<Timer size={13} />}
                      label="Telemetri"
                      value={fmtDuration(analysis.duration)}
                      hint={`${analysis.stats.telemetryRows.toLocaleString("tr-TR")} satır`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Not */}
          <div className="mt-5">
            <Field
              label="Uçuş notu"
              hint="Kaydedilirse uçuş notlarına da eklenir"
            >
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={LIMITS.longText}
                placeholder="Kalkış temiz, 3. turda rüzgâr arttı, iniş sırasında sol kanatta titreşim…"
                className="field resize-y"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-5">
            {analysis && <Badge tone="ok">Analiz hazır</Badge>}
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button onClick={complete} disabled={saving || analyzing}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : logFile ? (
                <Upload size={16} />
              ) : (
                <FlagTriangleRight size={16} />
              )}
              {saving ? "Kaydediliyor…" : "Uçuşu Tamamla"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-bg-1 px-3 py-2.5">
      <div className="flex items-center gap-1 text-ink-3">
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="tabular mt-1 text-[15px] font-bold text-ink">{value}</div>
      {hint && <div className="tabular text-[10.5px] text-ink-3">{hint}</div>}
    </div>
  );
}
