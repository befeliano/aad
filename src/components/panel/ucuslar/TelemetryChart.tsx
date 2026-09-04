"use client";

import { useMemo, useId } from "react";
import type { TelemetryPoint } from "@/lib/flight-db";

export interface Series {
  key: string;
  label: string;
  unit: string;
  color: string;
  /** Noktadan değeri çıkarır */
  pick: (p: TelemetryPoint) => number;
}

/** Grafikte gösterilebilecek telemetri kanalları */
export const SERIES: Series[] = [
  { key: "alt", label: "İrtifa", unit: "m", color: "#22d3c4", pick: (p) => p.alt },
  { key: "speed", label: "Hız", unit: "m/s", color: "#f59e0b", pick: (p) => p.speed },
  { key: "pitch", label: "Dikilme", unit: "°", color: "#a78bfa", pick: (p) => p.pitch },
  { key: "roll", label: "Yatış", unit: "°", color: "#4ade80", pick: (p) => p.roll },
  { key: "lag", label: "Gecikme", unit: "ms", color: "#f472b6", pick: (p) => p.lag },
];

const W = 1000;
const H = 150;
const PAD_L = 46;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 20;

/**
 * Tek bir telemetri kanalının zaman grafiği.
 * SVG ile çizilir — ek kütüphane gerekmez, tema renklerine uyar.
 * Çok sayıda nokta olduğunda ekran genişliğine göre örnekleme yapılır.
 */
export function TelemetryChart({
  points,
  series,
  duration,
  time,
  onSeek,
}: {
  points: TelemetryPoint[];
  series: Series;
  duration: number;
  time: number;
  onSeek?: (t: number) => void;
}) {
  const gid = useId().replace(/:/g, "");

  const { path, area, min, max, sampled } = useMemo(() => {
    if (!points.length) {
      return { path: "", area: "", min: 0, max: 0, sampled: [] as TelemetryPoint[] };
    }

    // Yatay çözünürlükten fazla nokta çizmenin faydası yok — örnekle
    const step = Math.max(1, Math.floor(points.length / W));
    const s: TelemetryPoint[] = [];
    for (let i = 0; i < points.length; i += step) s.push(points[i]);
    if (s[s.length - 1] !== points[points.length - 1]) {
      s.push(points[points.length - 1]);
    }

    const vals = s.map(series.pick);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 1e-6) {
      hi = lo + 1;
      lo -= 1;
    }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;

    const x = (t: number) =>
      PAD_L + (t / Math.max(duration, 1e-6)) * (W - PAD_L - PAD_R);
    const y = (v: number) =>
      PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

    const d = s
      .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(series.pick(p)).toFixed(1)}`)
      .join(" ");

    const a =
      d +
      ` L${x(s[s.length - 1].t).toFixed(1)} ${H - PAD_B}` +
      ` L${x(s[0].t).toFixed(1)} ${H - PAD_B} Z`;

    return { path: d, area: a, min: lo, max: hi, sampled: s };
  }, [points, series, duration]);

  if (!points.length) return null;

  const playX =
    PAD_L + (time / Math.max(duration, 1e-6)) * (W - PAD_L - PAD_R);

  /** Anlık değer */
  const current = (() => {
    let cur = sampled[0];
    for (const p of sampled) {
      if (p.t > time) break;
      cur = p;
    }
    return cur ? series.pick(cur) : 0;
  })();

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width; // 0..1 (görüntü genişliği)
    const svgX = rel * W;
    const t =
      ((svgX - PAD_L) / (W - PAD_L - PAD_R)) * duration;
    onSeek(Math.min(duration, Math.max(0, t)));
  }

  return (
    <div className="rounded-xl border border-line bg-bg-1 p-3">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: series.color }}
          />
          <span className="text-[12.5px] font-semibold text-ink">
            {series.label}
          </span>
        </span>
        <span className="tabular text-[12.5px] font-bold text-ink">
          {current.toFixed(1)}
          <span className="ml-0.5 text-[11px] font-medium text-ink-3">
            {series.unit}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`h-[110px] w-full ${onSeek ? "cursor-crosshair" : ""}`}
        onClick={handleClick}
        role="img"
        aria-label={`${series.label} zaman grafiği`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={series.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Yatay kılavuzlar + eksen etiketleri */}
        {[0, 0.5, 1].map((f) => {
          const yy = PAD_T + f * (H - PAD_T - PAD_B);
          const v = max - f * (max - min);
          return (
            <g key={f}>
              <line
                x1={PAD_L}
                y1={yy}
                x2={W - PAD_R}
                y2={yy}
                stroke="var(--line)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD_L - 6}
                y={yy + 3.5}
                textAnchor="end"
                fill="var(--ink-3)"
                style={{ fontSize: 11 }}
              >
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}

        <path d={area} fill={`url(#g${gid})`} />
        <path
          d={path}
          fill="none"
          stroke={series.color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Oynatma imleci */}
        <line
          x1={playX}
          y1={PAD_T}
          x2={playX}
          y2={H - PAD_B}
          stroke="var(--ink)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
