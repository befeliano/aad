/* ============================================================
   flight-db.ts — Uçuş .db (SQLite) dosyasını tarayıcıda ayrıştırır.
   sql.js (WASM) kullanır; hiçbir veri sunucuya gönderilmez.
   Şema: aadFlight/backend ile birebir uyumlu.
   ============================================================ */

import type { Database, SqlJsStatic } from "sql.js";

export interface TelemetryPoint {
  t: number; // saniye (oturum başlangıcına göre)
  lat: number;
  lon: number;
  alt: number;
  pitch: number; // iha_dikilme
  yaw: number; // iha_yonelme
  roll: number; // iha_yatis
  speed: number; // iha_hiz
  lag: number; // iha_zamanfarki (ms)
}

export interface GuidanceEvent {
  t: number;
  mode: string;
  lock: number;
  info: string;
}

export interface LockEvent {
  t: number;
  locked: boolean;
  trackId: number | null;
}

export interface NfzZone {
  index: number;
  lat: number;
  lon: number;
  radius: number;
}

export interface FlightSession {
  fileName: string;
  t0: number; // epoch
  duration: number; // saniye
  teams: number[];
  tracks: Record<number, TelemetryPoint[]>;
  rk4: Record<number, TelemetryPoint[]>;
  guidance: GuidanceEvent[];
  locks: LockEvent[];
  nfz: NfzZone[];
  targetSelections: { t: number; targetId: number }[];
  configName: string | null;
  stats: {
    maxAlt: number;
    maxSpeed: number;
    avgSpeed: number;
    lockCount: number;
    distanceKm: number;
    telemetryRows: number;
  };
  center: [number, number];
}

/* ---------- Mod renkleri (aadFlight/config.js ile aynı) ---------- */
export const MODE_COLORS: Record<string, { label: string; color: string; desc: string }> = {
  Nothing: {
    label: "NOTHING",
    color: "#6b7280",
    desc: "Güdüm aktif değil / hedef yok",
  },
  "Path Chase": {
    label: "PATH CHASE",
    color: "#3b82f6",
    desc: "Rota takibi / hedef kovalama",
  },
  "Pro Nav": {
    label: "PRO NAV",
    color: "#ef4444",
    desc: "Proportional Navigation — kilitlenme güdümü",
  },
};
export const UNKNOWN_MODE_COLOR = "#eab308";

export function modeInfo(name: string) {
  return (
    MODE_COLORS[name] || {
      label: (name || "—").toUpperCase(),
      color: UNKNOWN_MODE_COLOR,
      desc: "Bilinmeyen mod",
    }
  );
}

/** Takım renk paleti */
export const TEAM_COLORS = [
  "#22d3c4",
  "#f59e0b",
  "#a78bfa",
  "#4ade80",
  "#f472b6",
  "#60a5fa",
];

/* ---------- sql.js tekil yükleyici ---------- */
let sqlPromise: Promise<SqlJsStatic> | null = null;

async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const initSqlJs = (await import("sql.js")).default;
      return initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
    })();
  }
  return sqlPromise;
}

/** Tablonun var olup olmadığını kontrol eder */
function hasTable(db: Database, name: string): boolean {
  const r = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return r.length > 0 && r[0].values.length > 0;
}

/** exec sonucunu nesne dizisine çevirir */
function rows(db: Database, sql: string): Record<string, number | string | null>[] {
  let res;
  try {
    res = db.exec(sql);
  } catch {
    return [];
  }
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((v) => {
    const o: Record<string, number | string | null> = {};
    columns.forEach((c, i) => {
      o[c] = v[i] as number | string | null;
    });
    return o;
  });
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** İki koordinat arası mesafe (metre) — haversine */
function distanceM(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * .db dosyasını ayrıştırıp oynatılabilir bir oturum nesnesi üretir.
 */
export async function parseFlightDb(file: File): Promise<FlightSession> {
  const SQL = await getSql();
  const buf = new Uint8Array(await file.arrayBuffer());

  let db: Database;
  try {
    db = new SQL.Database(buf);
  } catch {
    throw new Error(
      "Dosya geçerli bir SQLite veritabanı değil. Uçuş kaydı .db dosyası seçtiğinizden emin olun."
    );
  }

  try {
    if (!hasTable(db, "incoming_telemetry")) {
      throw new Error(
        "Bu .db bir uçuş kaydı gibi görünmüyor — 'incoming_telemetry' tablosu bulunamadı."
      );
    }

    const telem = rows(
      db,
      "SELECT * FROM incoming_telemetry ORDER BY timestamp ASC"
    );
    if (telem.length === 0) {
      throw new Error("Uçuş kaydında telemetri verisi yok (tablo boş).");
    }

    /* Zaman referansı: tüm tablolardaki en küçük timestamp */
    const allTs: number[] = telem.map((r) => num(r.timestamp));
    const t0 = Math.min(...allTs);
    const tEnd = Math.max(...allTs);

    const toPoint = (r: Record<string, unknown>): TelemetryPoint => ({
      t: num(r.timestamp) - t0,
      lat: num(r.iha_enlem),
      lon: num(r.iha_boylam),
      alt: num(r.iha_irtifa),
      pitch: num(r.iha_dikilme),
      yaw: num(r.iha_yonelme),
      roll: num(r.iha_yatis),
      speed: num(r.iha_hiz),
      lag: num(r.iha_zamanfarki),
    });

    /* Takıma göre grupla */
    const tracks: Record<number, TelemetryPoint[]> = {};
    telem.forEach((r) => {
      const team = num(r.takim_numarasi);
      (tracks[team] ||= []).push(toPoint(r));
    });
    const teams = Object.keys(tracks)
      .map(Number)
      .sort((a, b) => a - b);

    /* RK4 tahminleri */
    const rk4: Record<number, TelemetryPoint[]> = {};
    if (hasTable(db, "rk4_predictions")) {
      rows(db, "SELECT * FROM rk4_predictions ORDER BY timestamp ASC").forEach(
        (r) => {
          const team = num(r.takim_numarasi);
          (rk4[team] ||= []).push(toPoint(r));
        }
      );
    }

    /* Güdüm modu geçmişi */
    const guidance: GuidanceEvent[] = hasTable(db, "guidance_info")
      ? rows(db, "SELECT * FROM guidance_info ORDER BY timestamp ASC").map(
          (r) => ({
            t: num(r.timestamp) - t0,
            mode: String(r.current_mode ?? "—"),
            lock: num(r.mode_lock),
            info: String(r.info ?? ""),
          })
        )
      : [];

    /* Kilitlenme olayları (img_proc üzerinden geçişleri çıkar) */
    const locks: LockEvent[] = [];
    if (hasTable(db, "img_proc")) {
      let prev = -1;
      rows(
        db,
        "SELECT timestamp, target_track_id, iha_kilitlenme FROM img_proc ORDER BY timestamp ASC"
      ).forEach((r) => {
        const v = num(r.iha_kilitlenme);
        if (v !== prev) {
          locks.push({
            t: num(r.timestamp) - t0,
            locked: v === 1,
            trackId:
              r.target_track_id === null ? null : num(r.target_track_id),
          });
          prev = v;
        }
      });
    }

    /* Hedef seçimi */
    const targetSelections = hasTable(db, "target_selection")
      ? rows(
          db,
          "SELECT timestamp, hedef_id FROM target_selection ORDER BY timestamp ASC"
        ).map((r) => ({
          t: num(r.timestamp) - t0,
          targetId: num(r.hedef_id),
        }))
      : [];

    /* HSS bölgeleri */
    const nfz: NfzZone[] = hasTable(db, "nfz_areas")
      ? rows(
          db,
          "SELECT zone_index, latitude, longitude, radius FROM nfz_areas"
        ).map((r) => ({
          index: num(r.zone_index),
          lat: num(r.latitude),
          lon: num(r.longitude),
          radius: num(r.radius),
        }))
      : [];

    /* Oturum konfigürasyonu */
    let configName: string | null = null;
    if (hasTable(db, "session_config")) {
      const c = rows(db, "SELECT filename FROM session_config LIMIT 1");
      configName = c.length ? String(c[0].filename ?? "") || null : null;
    }

    /* İstatistikler */
    let maxAlt = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedN = 0;
    let distance = 0;

    Object.values(tracks).forEach((pts) => {
      let prev: TelemetryPoint | null = null;
      pts.forEach((p) => {
        maxAlt = Math.max(maxAlt, p.alt);
        maxSpeed = Math.max(maxSpeed, p.speed);
        speedSum += p.speed;
        speedN++;
        if (prev && p.lat && p.lon && prev.lat && prev.lon) {
          distance += distanceM(prev.lat, prev.lon, p.lat, p.lon);
        }
        prev = p;
      });
    });

    /* Harita merkezi — geçerli koordinatların ortalaması */
    const valid = telem
      .map((r) => [num(r.iha_enlem), num(r.iha_boylam)] as [number, number])
      .filter(([la, lo]) => Math.abs(la) > 0.0001 && Math.abs(lo) > 0.0001);
    const center: [number, number] = valid.length
      ? [
          valid.reduce((a, v) => a + v[0], 0) / valid.length,
          valid.reduce((a, v) => a + v[1], 0) / valid.length,
        ]
      : [39.8198, 30.5341]; // Eskişehir

    return {
      fileName: file.name,
      t0,
      duration: Math.max(1, tEnd - t0),
      teams,
      tracks,
      rk4,
      guidance,
      locks,
      nfz,
      targetSelections,
      configName,
      stats: {
        maxAlt,
        maxSpeed,
        avgSpeed: speedN ? speedSum / speedN : 0,
        lockCount: locks.filter((l) => l.locked).length,
        distanceKm: distance / 1000,
        telemetryRows: telem.length,
      },
      center,
    };
  } finally {
    db.close();
  }
}

/**
 * Verilen zamandaki (saniye) telemetri noktasını bulur.
 * Diziler zamana göre sıralı olduğu için ikili arama kullanır.
 */
export function pointAt(
  pts: TelemetryPoint[],
  t: number
): TelemetryPoint | null {
  if (!pts.length) return null;
  if (t <= pts[0].t) return pts[0];
  if (t >= pts[pts.length - 1].t) return pts[pts.length - 1];

  let lo = 0;
  let hi = pts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t === t) return pts[mid];
    if (pts[mid].t < t) lo = mid + 1;
    else hi = mid - 1;
  }
  return pts[Math.max(0, hi)];
}

/** t anına kadarki (ve trailSec süresindeki) iz noktalarını döndürür */
export function trailUpTo(
  pts: TelemetryPoint[],
  t: number,
  trailSec: number
): [number, number][] {
  const from = trailSec >= 9999 ? -Infinity : t - trailSec;
  const out: [number, number][] = [];
  for (const p of pts) {
    if (p.t > t) break;
    if (p.t >= from && Math.abs(p.lat) > 0.0001) out.push([p.lat, p.lon]);
  }
  return out;
}

/** Zamandaki aktif güdüm modunu bulur */
export function guidanceAt(
  events: GuidanceEvent[],
  t: number
): GuidanceEvent | null {
  if (!events.length) return null;
  let cur: GuidanceEvent | null = null;
  for (const e of events) {
    if (e.t > t) break;
    cur = e;
  }
  return cur ?? events[0];
}
