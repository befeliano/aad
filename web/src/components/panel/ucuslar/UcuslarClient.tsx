"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Pencil,
  Plane,
  Clock,
  MapPin,
  User,
  CalendarClock,
  Timer,
  Activity,
  Rocket,
  CircleCheck,
  Square,
  Database,
  Activity as ActivityIcon,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtTime, toCSV, downloadFile } from "@/lib/format";
import type { Flight } from "@/lib/types";
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
import { PreflightModal } from "./PreflightModal";
import { CompleteFlightModal, type ActiveSession } from "./CompleteFlightModal";
import { useElapsed, formatElapsed, useWakeLock } from "./useElapsed";
import { parseFlightDb } from "@/lib/flight-db";
import { logAction } from "@/lib/audit";
import { safeExt, safeFileName } from "@/lib/security";

/** Uçuşun tarih+saatini tek bir Date'e çevirir */
function flightDate(f: Flight): Date {
  return new Date(`${f.flight_date}T${f.flight_time || "00:00:00"}`);
}

export function UcuslarClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const [editing, setEditing] = useState<Flight | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Flight | null>(null);
  const [preflight, setPreflight] = useState<Flight | null>(null);
  /** flight_id -> uçuşun başlangıç zaman damgası (tamamlanmamışlar) */
  const [started, setStarted] = useState<Record<string, string>>({});
  /** flight_id -> tamamlanma zaman damgası */
  const [completed, setCompleted] = useState<Record<string, string>>({});
  /** flight_id -> gerçek uçuş süresi (saniye) */
  const [durationSec, setDurationSec] = useState<Record<string, number>>({});
  /** flight_id -> yüklenmiş uçuş kaydı (.db) yolu */
  const [logPath, setLogPath] = useState<Record<string, string>>({});
  /** Şu an log yüklenen uçuş */
  const [uploadingLog, setUploadingLog] = useState<string | null>(null);
  const logInputRef = useRef<HTMLInputElement>(null);
  const logTargetRef = useRef<Flight | null>(null);
  const [completing, setCompleting] = useState<ActiveSession | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("flights")
      .select("*")
      .order("flight_date", { ascending: false })
      .order("flight_time", { ascending: false });
    if (error) toast("Uçuşlar yüklenemedi: " + error.message, "error");
    else setFlights((data as Flight[]) || []);

    /* Başlatılmış uçuşlar — checklist tablosu yoksa sessizce atlanır */
    const { data: cl } = await supabase
      .from("flight_checklists")
      .select("flight_id, started_at, completed_at, stats, log_path");
    if (cl) {
      const m: Record<string, string> = {};
      const done: Record<string, string> = {};
      const dur: Record<string, number> = {};
      const logs: Record<string, string> = {};
      (
        cl as {
          flight_id: string;
          started_at: string | null;
          completed_at: string | null;
          stats: { duration_s?: number } | null;
          log_path: string | null;
        }[]
      ).forEach((r) => {
        // Yalnızca başlamış ve henüz tamamlanmamış uçuşlar "uçuşta" sayılır
        if (r.started_at && !r.completed_at) m[r.flight_id] = r.started_at;
        if (r.completed_at) done[r.flight_id] = r.completed_at;
        const secs = r.stats?.duration_s;
        if (typeof secs === "number") dur[r.flight_id] = secs;
        if (r.log_path) logs[r.flight_id] = r.log_path;
      });
      setStarted(m);
      setCompleted(done);
      setDurationSec(dur);
      setLogPath(logs);
    }

    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra
       çalışır, dolayısıyla senkron bir render zinciri oluşmaz. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:flights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flights" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const needle = q.trim().toLocaleLowerCase("tr");
    const match = (f: Flight) =>
      !needle ||
      `${f.aircraft} ${f.pilot || ""} ${f.location || ""} ${f.mission || ""}`
        .toLocaleLowerCase("tr")
        .includes(needle);

    /* Sınıflandırma önceliği:
       1) Tamamlandıysa → Geçmiş (planlanan saat gelecekte olsa bile)
       2) Havadaysa      → Yaklaşan, en üstte
       3) Değilse        → planlanan tarihe göre */
    const up: Flight[] = [];
    const pa: Flight[] = [];

    flights.filter(match).forEach((f) => {
      if (completed[f.id]) pa.push(f);
      else if (started[f.id]) up.push(f);
      else if (flightDate(f) >= now) up.push(f);
      else pa.push(f);
    });

    up.sort((a, b) => {
      // Havadaki uçuş her zaman en üstte
      const aFly = started[a.id] ? 0 : 1;
      const bFly = started[b.id] ? 0 : 1;
      if (aFly !== bFly) return aFly - bFly;
      return +flightDate(a) - +flightDate(b);
    });
    // Geçmiş: en son tamamlanan/uçulan en üstte
    pa.sort((a, b) => {
      const aT = completed[a.id] ? +new Date(completed[a.id]) : +flightDate(a);
      const bT = completed[b.id] ? +new Date(completed[b.id]) : +flightDate(b);
      return bT - aT;
    });

    return { upcoming: up, past: pa };
  }, [flights, q, started, completed]);

  const stats = useMemo(() => {
    const now = new Date();
    const isDone = (f: Flight) =>
      !!completed[f.id] || (!started[f.id] && flightDate(f) < now);
    const done = flights.filter(isDone);
    // Gerçek saniye varsa onu kullan, yoksa dakika alanına düş
    const totalSec = flights.reduce(
      (a, f) =>
        a +
        (durationSec[f.id] !== undefined
          ? durationSec[f.id]
          : Number(f.duration || 0) * 60),
      0
    );
    const aircraft = new Set(flights.map((f) => f.aircraft)).size;
    return {
      total: flights.length,
      done: done.length,
      upcoming: flights.length - done.length,
      // 1 saatin altında dakika göster — "0.0 sa" anlamsız duruyordu
      airtime:
        totalSec >= 3600
          ? `${(totalSec / 3600).toFixed(1)} sa`
          : totalSec >= 60
            ? `${Math.round(totalSec / 60)} dk`
            : `${Math.round(totalSec)} sn`,
      aircraft,
    };
  }, [flights, started, completed, durationSec]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      flight_date: String(fd.get("flight_date") || ""),
      flight_time: String(fd.get("flight_time") || ""),
      aircraft: String(fd.get("aircraft") || "").trim(),
      pilot: String(fd.get("pilot") || "").trim() || null,
      location: String(fd.get("location") || "").trim() || null,
      duration: fd.get("duration") ? Number(fd.get("duration")) : null,
      mission: String(fd.get("mission") || "").trim() || null,
    };
    if (!payload.flight_date || !payload.flight_time || !payload.aircraft) {
      toast("Tarih, saat ve uçak zorunlu.", "error");
      return;
    }

    setSaving(true);
    const { error } = editing
      ? await supabase.from("flights").update(payload).eq("id", editing.id)
      : await supabase
          .from("flights")
          .insert([{ ...payload, created_by: userId }]);
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    toast(editing ? "Uçuş güncellendi." : "Uçuş kaydedildi.");
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("flights")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else toast("Uçuş kaydı silindi.");
    setDelTarget(null);
    load();
  }

  /** Geçmiş bir uçuşa sonradan .db uçuş kaydı iliştirir */
  async function attachLog(flight: Flight, file: File) {
    setUploadingLog(flight.id);
    try {
      // Önce tarayıcıda çözümleyip istatistikleri çıkar (mesafe, irtifa…)
      let stats: Record<string, unknown> = {
        log_name: safeFileName(file.name),
      };
      if (/\.(db|sqlite|sqlite3)$/i.test(file.name)) {
        try {
          const s = await parseFlightDb(file);
          stats = {
            ...stats,
            duration_s: Math.round(s.duration),
            distance_km: +s.stats.distanceKm.toFixed(3),
            max_alt: +s.stats.maxAlt.toFixed(1),
            max_speed: +s.stats.maxSpeed.toFixed(1),
            avg_speed: +s.stats.avgSpeed.toFixed(1),
            telemetry_rows: s.stats.telemetryRows,
          };
        } catch (ex) {
          toast(
            "Dosya çözümlenemedi, yine de kaydediliyor: " + (ex as Error).message,
            "error"
          );
        }
      }

      const path = `flights/${flight.id}/${crypto.randomUUID()}.${safeExt(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("flight-logs")
        .upload(path, file, { upsert: false });
      if (upErr) {
        toast(
          "Yüklenemedi: " + upErr.message + " (flight-session.sql çalıştırıldı mı?)",
          "error"
        );
        return;
      }

      const { error } = await supabase
        .from("flight_checklists")
        .upsert(
          [{ flight_id: flight.id, log_path: path, stats }],
          { onConflict: "flight_id" }
        );
      if (error) {
        toast("Kaydedilemedi: " + error.message, "error");
        return;
      }
      logAction(supabase, "update", "flight_checklists", flight.id, {
        log: safeFileName(file.name),
      });
      toast("Uçuş kaydı eklendi — analiz için hazır.");
      load();
    } finally {
      setUploadingLog(null);
    }
  }

  function exportCSV() {
    const rows = flights.map((f) => [
      f.flight_date,
      fmtTime(f.flight_time),
      f.aircraft,
      f.pilot || "",
      f.location || "",
      f.duration ?? "",
      f.mission || "",
    ]);
    downloadFile(
      toCSV(
        ["Tarih", "Saat", "Uçak", "Pilot", "Konum", "Süre (dk)", "Görev"],
        rows
      ),
      `ucus-kayitlari-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`${rows.length} uçuş dışa aktarıldı.`);
  }

  /** Şu an havada olan uçuş (varsa) — üstteki canlı şerit için */
  const activeFlight = useMemo(() => {
    const id = Object.keys(started)[0];
    if (!id) return null;
    const f = flights.find((x) => x.id === id);
    return f ? { flight: f, startedAt: started[id] } : null;
  }, [started, flights]);

  // Uçuş sürerken ekran kapanmasın (destekleyen tarayıcılarda)
  useWakeLock(!!activeFlight);

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <>
      <PageHeader
        title="Uçuş Kayıtları"
        desc="Planlanan ve gerçekleşen test uçuşlarının kaydı. Telemetri analizi için uçuş verisi yükleyebilirsiniz."
      >
        <Link href="/panel/ucuslar/analiz">
          <Button variant="outline" size="md">
            <Activity size={15} />
            Uçuş Analizi
          </Button>
        </Link>
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
          Uçuş Planla
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon={<Plane size={18} />}
          label="Toplam Uçuş"
          value={String(stats.total)}
        />
        <SummaryTile
          icon={<CalendarClock size={18} />}
          label="Yaklaşan"
          value={String(stats.upcoming)}
        />
        <SummaryTile
          icon={<Timer size={18} />}
          label="Havada Kalış"
          value={stats.airtime}
        />
        <SummaryTile
          icon={<Activity size={18} />}
          label="Platform"
          value={String(stats.aircraft)}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex rounded-full border border-line p-0.5">
            {(
              [
                ["upcoming", `Yaklaşan (${upcoming.length})`],
                ["past", `Geçmiş (${past.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  tab === key
                    ? "bg-accent text-white"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative ml-auto min-w-[210px] flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Uçak, pilot, görev ara…"
              className="field !pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">
            Yükleniyor…
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Plane size={30} />}
            title={
              tab === "upcoming"
                ? "Planlanmış uçuş yok"
                : "Geçmiş uçuş kaydı yok"
            }
            desc={
              tab === "upcoming"
                ? "Yeni bir test uçuşu planlayarak takımı bilgilendirin."
                : "Gerçekleşen uçuşlar burada listelenir."
            }
            action={
              tab === "upcoming" ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={16} />
                  Uçuş Planla
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {list.map((f) => {
              const d = flightDate(f);
              const isPast = tab === "past";
              return (
                <li
                  key={f.id}
                  className={`flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-2/60 ${
                    isPast ? "opacity-80" : ""
                  }`}
                >
                  {/* Tarih bloğu */}
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-bg-2">
                    <span className="display tabular text-xl leading-none text-ink">
                      {d.getDate()}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                      {d.toLocaleDateString("tr-TR", { month: "short" })}
                    </span>
                  </div>

                  <div className="min-w-[190px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{f.aircraft}</span>
                      <Badge tone={isPast ? "neutral" : "accent"}>
                        {fmtTime(f.flight_time)}
                      </Badge>
                      {completed[f.id] && (
                        <Badge tone="ok">Tamamlandı</Badge>
                      )}
                      {durationSec[f.id] !== undefined ? (
                        <Badge tone="info">
                          {durationSec[f.id] < 60
                            ? `${Math.round(durationSec[f.id])} sn uçuş`
                            : `${formatElapsed(durationSec[f.id])} uçuş`}
                        </Badge>
                      ) : f.duration ? (
                        <Badge tone="info">{f.duration} dk uçuş</Badge>
                      ) : null}
                    </div>
                    {f.mission && (
                      <p className="mt-1 text-sm text-ink-2">{f.mission}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                      {f.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />
                          {f.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <User size={12} />
                        {f.pilot || "Pilot atanmadı"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {fmtDate(f.flight_date)}
                      </span>
                      {completed[f.id] && (
                        <span className="inline-flex items-center gap-1 text-ok">
                          <CircleCheck size={12} />
                          {new Date(completed[f.id]).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          tamamlandı
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isPast &&
                      !completed[f.id] &&
                      (started[f.id] ? (
                        <button
                          type="button"
                          onClick={() =>
                            setCompleting({ flight: f, startedAt: started[f.id] })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1.5 text-[12.5px] font-bold text-ok transition-colors hover:bg-ok/25"
                          title="Uçuşu tamamla"
                        >
                          <CircleCheck size={14} />
                          Uçuşta
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreflight(f)}
                          title="Uçuş öncesi kontrol listesini aç"
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-bold text-white transition-transform hover:scale-105"
                        >
                          <Rocket size={14} />
                          Uç!
                        </button>
                      ))}
                    {logPath[f.id] ? (
                      <Link href={`/panel/ucuslar/analiz?flight=${f.id}`}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1.5 text-[12.5px] font-bold text-accent transition-colors hover:bg-accent hover:text-white"
                          title="Bu uçuşun telemetri analizini aç"
                        >
                          <ActivityIcon size={14} />
                          Analiz
                        </button>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadingLog === f.id}
                        onClick={() => {
                          logTargetRef.current = f;
                          logInputRef.current?.click();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:border-line-2 hover:text-ink disabled:opacity-60"
                        title="Uçuş kaydı (.db) ekle"
                      >
                        {uploadingLog === f.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Database size={14} />
                        )}
                        {uploadingLog === f.id ? "Yükleniyor" : "Log Ekle"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(f);
                        setFormOpen(true);
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                      aria-label="Düzenle"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelTarget(f)}
                      className="flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                      aria-label="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Uçuşu Düzenle" : "Yeni Uçuş"}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tarih">
              <input
                name="flight_date"
                type="date"
                required
                defaultValue={
                  editing?.flight_date || new Date().toISOString().slice(0, 10)
                }
                className="field"
              />
            </Field>
            <Field label="Saat">
              <input
                name="flight_time"
                type="time"
                required
                defaultValue={editing?.flight_time?.slice(0, 5) || "10:00"}
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Uçak / Platform">
              <input
                name="aircraft"
                required
                defaultValue={editing?.aircraft || ""}
                placeholder="örn. HYDRA"
                className="field"
              />
            </Field>
            <Field label="Pilot">
              <input
                name="pilot"
                defaultValue={editing?.pilot || ""}
                placeholder="Ad Soyad"
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Konum">
              <input
                name="location"
                defaultValue={editing?.location || ""}
                placeholder="örn. ESTÜ Pisti"
                className="field"
              />
            </Field>
            <Field label="Süre (dakika)" hint="Uçuş sonrası doldurulabilir">
              <input
                name="duration"
                type="number"
                min="0"
                defaultValue={editing?.duration ?? ""}
                className="field"
              />
            </Field>
          </div>

          <Field label="Görev tanımı">
            <textarea
              name="mission"
              rows={3}
              defaultValue={editing?.mission || ""}
              placeholder="örn. Otonom hedef takibi ve kilitlenme testi"
              className="field resize-y"
            />
          </Field>

          <div className="flex justify-end gap-2.5 pt-2">
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
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sonradan .db iliştirme için gizli dosya girişi */}
      <input
        ref={logInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,.db-wal"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          const target = logTargetRef.current;
          if (f && target) attachLog(target, f);
          logTargetRef.current = null;
          e.target.value = "";
        }}
      />

      {/* Sabit şerit son satırı kapatmasın */}
      {activeFlight && <div className="h-20" aria-hidden="true" />}

      {activeFlight && (
        <ActiveFlightBar
          flight={activeFlight.flight}
          startedAt={activeFlight.startedAt}
          onComplete={() => setCompleting(activeFlight)}
        />
      )}

      <CompleteFlightModal
        session={completing}
        open={!!completing}
        onClose={() => setCompleting(null)}
        onCompleted={load}
      />

      <PreflightModal
        flight={preflight}
        open={!!preflight}
        onClose={() => setPreflight(null)}
        onStarted={load}
      />

      <ConfirmDialog
        open={!!delTarget}
        message={`${delTarget?.aircraft} · ${fmtDate(
          delTarget?.flight_date
        )} uçuş kaydı silinecek. Bu işlem geri alınamaz.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-1 p-5">
      <div className="flex items-center gap-2 text-ink-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div className="display tabular mt-3 text-3xl text-ink">{value}</div>
    </div>
  );
}

/** Uçuş sürerken ekranın üstünde duran canlı kronometre şeridi */
function ActiveFlightBar({
  flight,
  startedAt,
  onComplete,
}: {
  flight: Flight;
  startedAt: string;
  onComplete: () => void;
}) {
  const elapsed = useElapsed(startedAt);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ok/30 bg-bg-1/95 backdrop-blur-xl lg:left-64">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-ok" />
        </span>

        <div className="min-w-0">
          <div className="text-[12.5px] font-bold text-ink">
            {flight.aircraft} havada
          </div>
          <div className="text-[11.5px] text-ink-3">
            {new Date(startedAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            itibarıyla
          </div>
        </div>

        <div className="tabular display ml-auto text-3xl text-ink sm:text-4xl">
          {formatElapsed(elapsed)}
        </div>

        <Button onClick={onComplete}>
          <Square size={15} />
          Uçuşu Tamamla
        </Button>
      </div>
    </div>
  );
}
