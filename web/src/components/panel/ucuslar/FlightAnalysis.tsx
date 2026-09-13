"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Upload,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ArrowLeft,
  Gauge,
  Mountain,
  Route,
  Crosshair,
  FileWarning,
  Loader2,
  Database,
  Compass,
  Timer,
  Globe,
  Map as MapIcon,
  Video,
  Library,
} from "lucide-react";
import {
  parseFlightDb,
  pointAt,
  guidanceAt,
  modeInfo,
  TEAM_COLORS,
  type FlightSession,
} from "@/lib/flight-db";
import { fmtDuration } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui/Kit";
import { TelemetryChart, SERIES } from "./TelemetryChart";
import { PageHeader } from "@/components/panel/PageHeader";
import { LogKutuphanesi } from "./LogKutuphanesi";

/** Uçuş kaydı üst sınırı (tarayıcıda ayrıştırılıyor) */
const MAX_LOG_MB = 50;

const FlightMap3D = dynamic(() => import("./FlightMap3D"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-bg-2 text-sm text-ink-3">
      3D görünüm yükleniyor…
    </div>
  ),
});

const FlightMap = dynamic(() => import("./FlightMap"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-bg-2 text-sm text-ink-3">
      Harita yükleniyor…
    </div>
  ),
});

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export function FlightAnalysis() {
  const params = useSearchParams();
  const flightId = params.get("flight");
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<FlightSession | null>(null);
  /** ?flight= ile gelen kaydın uçak/tarih bilgisi */
  const [linkedFlight, setLinkedFlight] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [kutuphaneAcik, setKutuphaneAcik] = useState(false);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trailSec, setTrailSec] = useState(15);
  const [showGhost, setShowGhost] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [chartKeys, setChartKeys] = useState<string[]>(["alt", "speed"]);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [follow, setFollow] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  /* ---------- dosya yükleme ---------- */
  const handleFile = useCallback(async (file: File) => {
    setError(null);

    /* Ayrıştırma tamamen tarayıcıda (sql.js) yapılıyor; sunucuya yükleme yok.
       Yine de çok büyük dosya sekmeyi kilitleyebileceği için açık bir sınır
       koyup anlaşılır bir mesaj veriyoruz. */
    if (file.size > MAX_LOG_MB * 1048576) {
      setError(
        `Dosya çok büyük: ${(file.size / 1048576).toFixed(1)} MB. ` +
          `Uçuş analizi için üst sınır ${MAX_LOG_MB} MB.`
      );
      return;
    }

    setParsing(true);
    setPlaying(false);
    try {
      const s = await parseFlightDb(file);
      setSession(s);
      setTime(0);
      setSelectedTeam(s.teams[0] ?? null);
    } catch (ex) {
      setError((ex as Error).message);
      setSession(null);
    } finally {
      setParsing(false);
    }
  }, []);

  /** Kütüphaneden seçilen kaydı storage'dan indirip çözümler */
  const kutuphanedenYukle = useCallback(
    async (path: string, ad: string) => {
      setParsing(true);
      setError(null);
      try {
        const { data: signed, error: sErr } = await supabase.storage
          .from("flight-logs")
          .createSignedUrl(path, 600);
        if (sErr || !signed) throw new Error("Dosya bağlantısı alınamadı.");

        const blob = await (await fetch(signed.signedUrl)).blob();
        const sess = await parseFlightDb(new File([blob], ad));
        setSession(sess);
        setTime(0);
        setSelectedTeam(sess.teams[0] ?? null);
        setLinkedFlight(ad);
      } catch (ex) {
        setError((ex as Error).message);
      } finally {
        setParsing(false);
      }
    },
    [supabase]
  );

  /* ---------- ?flight= ile gelen uçuşun kaydını otomatik yükle ---------- */
  const loadLinkedFlight = useCallback(
    async (id: string) => {
      setParsing(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from("flight_checklists")
          .select("log_path, flights(aircraft, flight_date)")
          .eq("flight_id", id)
          .maybeSingle();

        if (qErr) throw new Error(qErr.message);
        const path = (data as { log_path: string | null } | null)?.log_path;
        if (!path) {
          throw new Error("Bu uçuşa yüklenmiş bir uçuş kaydı bulunamadı.");
        }

        const { data: signed, error: sErr } = await supabase.storage
          .from("flight-logs")
          .createSignedUrl(path, 600);
        if (sErr || !signed) {
          throw new Error("Dosya bağlantısı alınamadı.");
        }

        const blob = await (await fetch(signed.signedUrl)).blob();
        const name = path.split("/").pop() || "flight.db";
        const s = await parseFlightDb(new File([blob], name));

        setSession(s);
        setTime(0);
        setSelectedTeam(s.teams[0] ?? null);

        const f = (
          data as unknown as {
            flights?: { aircraft?: string; flight_date?: string } | null;
          }
        )?.flights;
        if (f?.aircraft) {
          setLinkedFlight(
            `${f.aircraft}${f.flight_date ? " · " + f.flight_date : ""}`
          );
        }
      } catch (ex) {
        setError((ex as Error).message);
      } finally {
        setParsing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!flightId) return;
    // loadLinkedFlight asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLinkedFlight(flightId);
  }, [flightId, loadLinkedFlight]);

  /* ---------- oynatma döngüsü ---------- */
  useEffect(() => {
    if (!playing || !session) return;
    lastTickRef.current = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setTime((t) => {
        const next = t + dt * speed;
        if (next >= session.duration) {
          setPlaying(false);
          return session.duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed, session]);

  /* ---------- klavye kısayolları ---------- */
  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        setTime((t) => Math.min(session.duration, t + (e.shiftKey ? 10 : 1)));
      } else if (e.key === "ArrowLeft") {
        setTime((t) => Math.max(0, t - (e.shiftKey ? 10 : 1)));
      } else if (e.key === "Home") {
        setTime(0);
      } else if (e.key === "End") {
        setTime(session.duration);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  /* ---------- türetilmiş anlık değerler ---------- */
  const activeTeam = selectedTeam ?? session?.teams[0] ?? null;
  const current = useMemo(() => {
    if (!session || activeTeam === null) return null;
    return pointAt(session.tracks[activeTeam] || [], time);
  }, [session, activeTeam, time]);

  const guidance = useMemo(
    () => (session ? guidanceAt(session.guidance, time) : null),
    [session, time]
  );

  /* ---------- yükleme ekranı ---------- */
  if (!session) {
    return (
      <>
        <PageHeader
          title="Uçuş Analizi"
          desc="Uçuş kaydı (.db) dosyanızı yükleyin — telemetri, rota ve güdüm kararları harita üzerinde oynatılır."
        >
          <Link href="/panel/ucuslar">
            <Button variant="outline" size="md">
              <ArrowLeft size={15} />
              Uçuş Kayıtları
            </Button>
          </Link>
        </PageHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-24 text-center transition-colors ${
            dragOver
              ? "border-accent bg-accent-soft"
              : "border-line-2 bg-bg-1"
          }`}
        >
          {parsing ? (
            <>
              <Loader2 size={34} className="animate-spin text-accent" />
              <p className="mt-5 text-sm font-semibold text-ink">
                Uçuş verisi ayrıştırılıyor…
              </p>
              <p className="mt-1.5 text-sm text-ink-3">
                Dosya tarayıcınızda işleniyor, sunucuya gönderilmiyor.
              </p>
            </>
          ) : (
            <>
              <Database size={34} className="text-ink-3" />
              <p className="mt-5 text-base font-bold text-ink">
                Uçuş kaydını buraya sürükleyin
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
                <code className="rounded bg-bg-3 px-1.5 py-0.5 text-[12.5px]">
                  flight_YYYYMMDD_HHMMSS.db
                </code>{" "}
                biçimindeki SQLite uçuş kaydı desteklenir. Dosya tamamen
                tarayıcınızda çözümlenir — hiçbir veri yüklenmez.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload size={16} />
                  Dosya Seç
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setKutuphaneAcik(true)}
                >
                  <Library size={16} />
                  Kütüphaneden Seç
                </Button>
              </div>
              <p className="mt-3 text-[12.5px] text-ink-3">
                Daha önce bir uçuşa yüklediğiniz kayıtlar kütüphanede duruyor —
                aynı dosyayı tekrar yüklemeniz gerekmez.
              </p>
            </>
          )}

          {error && (
            <div className="mt-7 flex max-w-md items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/8 p-4 text-left">
              <FileWarning size={17} className="mt-0.5 shrink-0 text-bad" />
              <p className="text-sm leading-relaxed text-bad">{error}</p>
            </div>
          )}
        </div>

        <LogKutuphanesi
          open={kutuphaneAcik}
          onClose={() => setKutuphaneAcik(false)}
          onSec={kutuphanedenYukle}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </>
    );
  }

  /* ---------- analiz ekranı ---------- */
  const pct = (time / session.duration) * 100;

  return (
    <>
      <PageHeader
        title="Uçuş Analizi"
        desc={linkedFlight ? `${linkedFlight} · ${session.fileName}` : session.fileName}
      >
        <Button variant="outline" size="md" onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
          Başka dosya
        </Button>
        <Link href="/panel/ucuslar">
          <Button variant="outline" size="md">
            <ArrowLeft size={15} />
            Geri
          </Button>
        </Link>
      </PageHeader>

      <input
        ref={fileRef}
        type="file"
        accept=".db,.sqlite,.sqlite3"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {/* Özet istatistikler */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={<Timer size={15} />} label="Süre" value={fmtDuration(session.duration)} />
        <Stat icon={<Mountain size={15} />} label="Maks. İrtifa" value={`${session.stats.maxAlt.toFixed(0)} m`} />
        <Stat icon={<Gauge size={15} />} label="Maks. Hız" value={`${session.stats.maxSpeed.toFixed(0)} m/s`} />
        <Stat icon={<Route size={15} />} label="Mesafe" value={`${session.stats.distanceKm.toFixed(2)} km`} />
        <Stat icon={<Crosshair size={15} />} label="Kilitlenme" value={String(session.stats.lockCount)} />
        <Stat icon={<Database size={15} />} label="Telemetri" value={session.stats.telemetryRows.toLocaleString("tr-TR")} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Harita + kontroller */}
        <div className="flex flex-col gap-4">
          <div className="relative h-[440px] overflow-hidden rounded-2xl border border-line sm:h-[540px]">
            {view === "3d" ? (
              <FlightMap3D
                session={session}
                time={time}
                trailSec={trailSec}
                showGhost={showGhost}
                selectedTeam={selectedTeam}
                follow={follow}
              />
            ) : (
              <FlightMap
                session={session}
                time={time}
                trailSec={trailSec}
                showGhost={showGhost}
                selectedTeam={selectedTeam}
              />
            )}

            {/* 2D / 3D geçişi */}
            <div className="absolute right-3 top-3 z-[500] flex items-center gap-1.5">
              {view === "3d" && (
                <button
                  type="button"
                  onClick={() => setFollow((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold backdrop-blur-md transition-colors ${
                    follow
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-bg/85 text-ink-2 hover:text-ink"
                  }`}
                  title="Kamerayı uçağa kilitle (TPS)"
                >
                  <Video size={14} />
                  Takip
                </button>
              )}
              <div className="flex rounded-lg border border-line bg-bg/85 p-0.5 backdrop-blur-md">
                {(
                  [
                    ["2d", "2D", MapIcon],
                    ["3d", "3D", Globe],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      view === key
                        ? "bg-accent text-white"
                        : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Güdüm modu rozeti */}
            {guidance && (
              <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2.5 rounded-xl border border-line bg-bg/85 px-3.5 py-2.5 backdrop-blur-md">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: modeInfo(guidance.mode).color }}
                />
                <div>
                  <div className="text-[13px] font-bold leading-tight text-ink">
                    {modeInfo(guidance.mode).label}
                  </div>
                  <div className="text-[11px] leading-tight text-ink-3">
                    {guidance.info || modeInfo(guidance.mode).desc}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transport kontrolleri */}
          <Card className="p-4">
            {/* Mod şeridi */}
            {session.guidance.length > 0 && (
              <div className="mb-3">
                <div className="eyebrow mb-1.5 !text-[9.5px]">Mod geçmişi</div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-bg-3">
                  {session.guidance.map((g, i) => {
                    const next =
                      session.guidance[i + 1]?.t ?? session.duration;
                    const left = (g.t / session.duration) * 100;
                    const w = ((next - g.t) / session.duration) * 100;
                    return (
                      <div
                        key={i}
                        title={`${modeInfo(g.mode).label} · ${fmtDuration(g.t)}`}
                        className="absolute inset-y-0"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(w, 0.3)}%`,
                          background: modeInfo(g.mode).color,
                        }}
                      />
                    );
                  })}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-ink"
                    style={{ left: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Zaman çubuğu */}
            <div className="flex items-center gap-3">
              <span className="tabular shrink-0 text-[13px] font-semibold text-ink">
                {fmtDuration(time)}
              </span>
              <input
                type="range"
                min={0}
                max={session.duration}
                step={0.05}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-bg-3 accent-[var(--accent)]"
                style={{
                  background: `linear-gradient(90deg, var(--accent) ${pct}%, var(--bg-3) ${pct}%)`,
                }}
                aria-label="Zaman"
              />
              <span className="tabular shrink-0 text-[13px] text-ink-3">
                {fmtDuration(session.duration)}
              </span>
            </div>

            {/* Butonlar */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTime(0)}
                className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
                aria-label="Başa dön"
              >
                <SkipBack size={15} />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="flex size-10 items-center justify-center rounded-full bg-accent text-white transition-transform hover:scale-105"
                aria-label={playing ? "Duraklat" : "Oynat"}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                type="button"
                onClick={() => setTime(session.duration)}
                className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
                aria-label="Sona git"
              >
                <SkipForward size={15} />
              </button>

              <div className="ml-1 flex rounded-full border border-line p-0.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                      speed === s
                        ? "bg-accent text-white"
                        : "text-ink-3 hover:text-ink"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
                İz
                <select
                  value={trailSec}
                  onChange={(e) => setTrailSec(Number(e.target.value))}
                  className="field !w-auto !py-1.5 !text-[13px]"
                >
                  <option value={5}>5 sn</option>
                  <option value={15}>15 sn</option>
                  <option value={30}>30 sn</option>
                  <option value={9999}>Tümü</option>
                </select>
              </label>

              {Object.keys(session.rk4).length > 0 && (
                <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={showGhost}
                    onChange={(e) => setShowGhost(e.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  RK4 izi
                </label>
              )}
            </div>

            <p className="mt-3 text-[11.5px] text-ink-3">
              Kısayollar: <b>Boşluk</b> oynat/duraklat · <b>← →</b> 1 sn ·{" "}
              <b>Shift + ← →</b> 10 sn · <b>Home/End</b>
            </p>
          </Card>

          {/* Telemetri zaman grafikleri */}
          <Card
            title="Telemetri Trendleri"
            desc={`Takım ${activeTeam ?? "—"} · grafiğe tıklayarak o ana atlayın`}
            actions={
              <div className="flex flex-wrap gap-1">
                {SERIES.map((s) => {
                  const on = chartKeys.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setChartKeys((v) =>
                          on ? v.filter((k) => k !== s.key) : [...v, s.key]
                        )
                      }
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                        on
                          ? "border-transparent text-white"
                          : "border-line text-ink-3 hover:text-ink"
                      }`}
                      style={on ? { background: s.color } : undefined}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            }
          >
            <div className="space-y-3 p-4">
              {chartKeys.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-3">
                  Görmek istediğiniz kanalı yukarıdan seçin.
                </p>
              ) : (
                SERIES.filter((s) => chartKeys.includes(s.key)).map((s) => (
                  <TelemetryChart
                    key={s.key}
                    points={
                      activeTeam !== null ? session.tracks[activeTeam] || [] : []
                    }
                    series={s}
                    duration={session.duration}
                    time={time}
                    onSeek={setTime}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Yan panel */}
        <div className="flex flex-col gap-4">
          <Card title="Uçaklar" desc="Kayıtta telemetri gönderen takımlar">
            <ul className="p-3">
              {session.teams.map((team, i) => {
                const color = TEAM_COLORS[i % TEAM_COLORS.length];
                const p = pointAt(session.tracks[team] || [], time);
                const active = activeTeam === team;
                return (
                  <li key={team}>
                    <button
                      type="button"
                      onClick={() => setSelectedTeam(team)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-bg-2" : "hover:bg-bg-2/60"
                      }`}
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="flex-1 text-sm font-semibold text-ink">
                        Takım {team}
                      </span>
                      <span className="tabular text-[12.5px] text-ink-3">
                        {p ? `${p.alt.toFixed(0)} m` : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Telemetri" desc={`Takım ${activeTeam ?? "—"} · anlık`}>
            <div className="grid grid-cols-2 gap-px bg-line">
              <Tele label="İrtifa" value={current ? `${current.alt.toFixed(1)} m` : "—"} />
              <Tele label="Hız" value={current ? `${current.speed.toFixed(1)} m/s` : "—"} />
              <Tele label="Yönelme" value={current ? `${current.yaw.toFixed(0)}°` : "—"} icon={<Compass size={12} />} />
              <Tele label="Dikilme" value={current ? `${current.pitch.toFixed(1)}°` : "—"} />
              <Tele label="Yatış" value={current ? `${current.roll.toFixed(1)}°` : "—"} />
              <Tele label="Gecikme" value={current ? `${current.lag.toFixed(0)} ms` : "—"} />
            </div>
            {current && (
              <div className="border-t border-line px-4 py-3">
                <div className="eyebrow !text-[9.5px]">Konum</div>
                <div className="tabular mt-1 text-[12.5px] text-ink-2">
                  {current.lat.toFixed(6)}, {current.lon.toFixed(6)}
                </div>
              </div>
            )}
          </Card>

          {session.locks.length > 0 && (
            <Card title="Kilitlenme Olayları">
              <ul className="max-h-56 overflow-y-auto p-3">
                {session.locks.map((l, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setTime(l.t)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-2"
                    >
                      <Badge tone={l.locked ? "bad" : "neutral"}>
                        {l.locked ? "KİLİT" : "BIRAKTI"}
                      </Badge>
                      <span className="tabular ml-auto text-[12.5px] text-ink-3">
                        {fmtDuration(l.t)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {session.configName && (
            <Card>
              <div className="px-5 py-4">
                <div className="eyebrow !text-[9.5px]">Oturum konfigürasyonu</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink">
                  {session.configName}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-1 px-4 py-3">
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="text-[11.5px] font-semibold">{label}</span>
      </div>
      <div className="tabular mt-1.5 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

function Tele({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-bg-1 px-4 py-3">
      <div className="flex items-center gap-1 text-ink-3">
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="tabular mt-1 text-[15px] font-bold text-ink">{value}</div>
    </div>
  );
}
