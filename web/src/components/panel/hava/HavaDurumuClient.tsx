"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wind,
  Droplets,
  Eye,
  Sunrise,
  Sunset,
  RefreshCw,
  MapPin,
  TriangleAlert,
  CircleCheck,
  CloudOff,
  Navigation,
  Plane,
  ExternalLink,
} from "lucide-react";
import {
  fetchForecast,
  weatherText,
  compass,
  toKmh,
  hourVerdict,
  VERDICT_META,
  FLIGHT_SITES,
  LIMITS,
  type DayForecast,
  type HourPoint,
} from "@/lib/weather";
import { Badge, Button, Card, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function dayLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((+d - +today) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  return DAY_NAMES[d.getDay()];
}

const hhmm = (iso: string) => iso.slice(11, 16);

export function HavaDurumuClient() {
  const [days, setDays] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  /* Hangi sahada uçulacak — ESTÜ pisti ya da İnönü */
  const [sahaKey, setSahaKey] = useState(FLIGHT_SITES[0].key);
  const saha =
    FLIGHT_SITES.find((s) => s.key === sahaKey) ?? FLIGHT_SITES[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchForecast(saha.lat, saha.lon);
      setDays(d);
      setSelected(0);
      setUpdatedAt(new Date());
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setLoading(false);
    }
  }, [saha.lat, saha.lon]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const day = days[selected];

  /** Seçili günün gündüz saatleri — uçuş penceresi bunlar arasından seçilir */
  const dayHours = useMemo(
    () => (day ? day.hours.filter((h) => h.isDay) : []),
    [day]
  );

  return (
    <>
      <PageHeader
        title="Hava Durumu"
        desc="Uçuş sahası için 5 günlük tahmin. Rüzgâr ve yağış eşiklerine göre uçuşa uygunluk otomatik değerlendirilir."
      >
        {/* ESTÜ Hasan Polatkan Havalimanı tarifeli uçuşları.
            Veriyi panele ÇEKMİYORUZ: sitenin şartlarına göre uçuş bilgileri
            Rektörlüğün yazılı izni olmadan başka yerde kullanılamaz.
            İzin alınırsa tablo buraya taşınabilir. */}
        <a
          href="https://hph.eskisehir.edu.tr/"
          target="_blank"
          rel="noopener noreferrer"
          title="Eskişehir Hasan Polatkan Havalimanı — gelen/giden uçuşlar"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-line-2 px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:border-ink-3"
        >
          <Plane size={15} />
          Havalimanı uçuşları
          <ExternalLink size={13} className="text-ink-3" />
        </a>
        <Button variant="outline" size="md" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Yenile
        </Button>
      </PageHeader>

      {/* Saha bilgisi */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg-1 px-5 py-4">
        <MapPin size={17} className="text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">{saha.name}</div>
          <div className="tabular text-[12px] text-ink-3">
            {saha.subtitle} · {saha.lat.toFixed(4)}, {saha.lon.toFixed(4)}
          </div>
        </div>
        <select
          value={sahaKey}
          onChange={(e) => setSahaKey(e.target.value)}
          className="field !w-auto !py-1.5 !text-[13px]"
          aria-label="Uçuş sahası seç"
        >
          {FLIGHT_SITES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        {updatedAt && (
          <span className="text-[12px] text-ink-3">
            Güncellendi {updatedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {error ? (
        <Card>
          <EmptyState
            icon={<CloudOff size={30} />}
            title="Hava durumu alınamadı"
            desc={error}
            action={
              <Button onClick={load}>
                <RefreshCw size={15} />
                Tekrar dene
              </Button>
            }
          />
        </Card>
      ) : loading && !days.length ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-line bg-bg-2"
            />
          ))}
        </div>
      ) : (
        <>
          {/* 5 günlük özet */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {days.map((d, i) => {
              const meta = VERDICT_META[d.verdict];
              const active = i === selected;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`rounded-2xl border p-5 text-left transition-all ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-bg-1 hover:border-line-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">
                      {dayLabel(d.date)}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-3">
                    {new Date(d.date + "T12:00:00").toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>

                  <div className="tabular mt-4 flex items-baseline gap-1.5">
                    <span className="display text-3xl text-ink">
                      {Math.round(d.tempMax)}°
                    </span>
                    <span className="text-sm text-ink-3">
                      {Math.round(d.tempMin)}°
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[12px] text-ink-2">
                    {weatherText(d.code)}
                  </div>

                  <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                    <Row
                      icon={<Wind size={13} />}
                      label="Rüzgâr"
                      value={`${d.windMax.toFixed(1)} m/s`}
                      warn={d.windMax > LIMITS.windMarginal}
                    />
                    <Row
                      icon={<Navigation size={13} />}
                      label="Hamle"
                      value={`${d.gustMax.toFixed(1)} m/s`}
                      warn={d.gustMax > LIMITS.gustMarginal}
                    />
                    <Row
                      icon={<Droplets size={13} />}
                      label="Yağış"
                      value={`%${Math.round(d.precipProbMax)}`}
                      warn={d.precipProbMax >= 70}
                    />
                  </div>

                  {d.bestWindow ? (
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-ok/10 px-2.5 py-2">
                      <CircleCheck size={13} className="mt-0.5 shrink-0 text-ok" />
                      <span className="text-[11.5px] leading-snug text-ok">
                        Uygun pencere {hhmm(d.bestWindow.from)}–
                        {hhmm(d.bestWindow.to)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-bg-2 px-2.5 py-2">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0 text-ink-3" />
                      <span className="text-[11.5px] leading-snug text-ink-3">
                        Uygun pencere yok
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Seçili gün — saatlik */}
          {day && (
            <Card
              className="mt-5"
              title={`${dayLabel(day.date)} · saatlik`}
              desc="Gündüz saatleri. Renk uçuşa uygunluğu gösterir."
              actions={
                <div className="flex items-center gap-3 text-[11.5px] text-ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Sunrise size={13} />
                    {hhmm(day.sunrise)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Sunset size={13} />
                    {hhmm(day.sunset)}
                  </span>
                </div>
              }
            >
              <div className="overflow-x-auto p-4">
                <div className="flex gap-2">
                  {dayHours.map((h) => (
                    <HourCard key={h.time} h={h} />
                  ))}
                </div>
              </div>

              {/* Eşik açıklaması */}
              <div className="border-t border-line px-5 py-4">
                <div className="eyebrow mb-2 !text-[9.5px]">
                  Uygunluk eşikleri (sabit kanat ~8 kg)
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-ink-2">
                  <span>
                    <Badge tone="ok">Uygun</Badge> rüzgâr ≤ {LIMITS.windGood} m/s ·
                    hamle ≤ {LIMITS.gustGood} m/s
                  </span>
                  <span>
                    <Badge tone="warn">Dikkatli</Badge> rüzgâr ≤{" "}
                    {LIMITS.windMarginal} m/s · hamle ≤ {LIMITS.gustMarginal} m/s
                  </span>
                  <span>
                    <Badge tone="bad">Uygun Değil</Badge> üzeri, yağış veya düşük
                    görüş
                  </span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function Row({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="text-ink-3">{icon}</span>
      <span className="text-ink-3">{label}</span>
      <span
        className={`tabular ml-auto font-semibold ${
          warn ? "text-bad" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function HourCard({ h }: { h: HourPoint }) {
  const v = hourVerdict(h);
  const meta = VERDICT_META[v];
  const tone =
    v === "uygun"
      ? "border-ok/40 bg-ok/8"
      : v === "dikkatli"
        ? "border-warn/40 bg-warn/8"
        : "border-bad/30 bg-bad/6";

  return (
    <div
      className={`w-[104px] shrink-0 rounded-xl border p-3 ${tone}`}
      title={`${meta.label} · ${weatherText(h.code)}`}
    >
      <div className="tabular text-[12.5px] font-bold text-ink">
        {hhmm(h.time)}
      </div>
      <div className="tabular mt-1 text-xl font-bold text-ink">
        {Math.round(h.temp)}°
      </div>

      <div className="mt-2.5 space-y-1 border-t border-line/60 pt-2 text-[11px]">
        <div className="flex items-center gap-1 text-ink-2">
          <Wind size={11} className="shrink-0" />
          <span className="tabular font-semibold">{h.wind.toFixed(1)}</span>
          <span className="text-ink-3">m/s</span>
        </div>
        <div className="tabular text-[10.5px] text-ink-3">
          {compass(h.dir)} · {Math.round(toKmh(h.wind))} km/s
        </div>
        <div className="tabular text-[10.5px] text-ink-3">
          hamle {h.gust.toFixed(1)}
        </div>
        <div className="flex items-center gap-1 text-ink-3">
          <Droplets size={10} className="shrink-0" />
          <span className="tabular text-[10.5px]">%{Math.round(h.precipProb)}</span>
        </div>
        {h.visibility < 5000 && (
          <div className="flex items-center gap-1 text-warn">
            <Eye size={10} className="shrink-0" />
            <span className="tabular text-[10.5px]">
              {(h.visibility / 1000).toFixed(1)} km
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
