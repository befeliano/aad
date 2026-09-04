/* ============================================================
   weather.ts — Uçuş planlaması için hava durumu
   Kaynak: Open-Meteo (ücretsiz, API anahtarı gerektirmez)
   ============================================================ */

/** Uçuş sahası — takımın kendi uçuş kaydındaki koordinatlar */
export const FLIGHT_SITE = {
  name: "ESTÜ İki Eylül Kampüsü",
  subtitle: "Uçuş sahası · Eskişehir",
  lat: 39.8198,
  lon: 30.5342,
};

/* ---------- Uçuşa uygunluk eşikleri (sabit kanat ~8 kg) ---------- */
export const LIMITS = {
  windGood: 6, // m/s
  windMarginal: 9,
  gustGood: 9,
  gustMarginal: 13,
  precipProbMarginal: 40, // %
  precipProbBad: 70,
  visibilityMarginal: 3000, // m
};

export type Verdict = "uygun" | "dikkatli" | "uygunsuz";

export const VERDICT_META: Record<
  Verdict,
  { label: string; tone: "ok" | "warn" | "bad" }
> = {
  uygun: { label: "Uygun", tone: "ok" },
  dikkatli: { label: "Dikkatli", tone: "warn" },
  uygunsuz: { label: "Uygun Değil", tone: "bad" },
};

export interface HourPoint {
  time: string; // ISO
  temp: number;
  wind: number; // m/s
  gust: number; // m/s
  dir: number; // derece
  precipProb: number; // %
  precip: number; // mm
  cloud: number; // %
  visibility: number; // m
  code: number;
  isDay: boolean;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  tempMin: number;
  tempMax: number;
  windMax: number;
  gustMax: number;
  precipSum: number;
  precipProbMax: number;
  sunrise: string;
  sunset: string;
  code: number;
  hours: HourPoint[];
  verdict: Verdict;
  /** Gün içindeki en uygun uçuş penceresi (varsa) */
  bestWindow: { from: string; to: string; wind: number } | null;
}

/* ---------- WMO hava kodu → Türkçe açıklama ---------- */
const WMO: Record<number, string> = {
  0: "Açık",
  1: "Az bulutlu",
  2: "Parçalı bulutlu",
  3: "Çok bulutlu",
  45: "Sisli",
  48: "Kırağılı sis",
  51: "Hafif çisenti",
  53: "Çisenti",
  55: "Yoğun çisenti",
  56: "Dondurucu çisenti",
  57: "Yoğun dondurucu çisenti",
  61: "Hafif yağmur",
  63: "Yağmur",
  65: "Şiddetli yağmur",
  66: "Dondurucu yağmur",
  67: "Şiddetli dondurucu yağmur",
  71: "Hafif kar",
  73: "Kar",
  75: "Yoğun kar",
  77: "Kar taneleri",
  80: "Hafif sağanak",
  81: "Sağanak",
  82: "Şiddetli sağanak",
  85: "Hafif kar sağanağı",
  86: "Kar sağanağı",
  95: "Gök gürültülü fırtına",
  96: "Dolulu fırtına",
  99: "Şiddetli dolulu fırtına",
};

export const weatherText = (code: number) => WMO[code] ?? "—";

/** Yağış/fırtına içeren kodlar uçuşu doğrudan olumsuz etkiler */
export function isPrecipCode(code: number) {
  return code >= 51;
}

/** Derece → pusula yönü */
export function compass(deg: number): string {
  const dirs = ["K", "KKD", "KD", "DKD", "D", "DGD", "GD", "GGD", "G", "GGB", "GB", "BGB", "B", "BKB", "KB", "KKB"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

/** m/s → km/s */
export const toKmh = (ms: number) => ms * 3.6;

/* ---------- Uygunluk hesabı ---------- */
export function hourVerdict(h: HourPoint): Verdict {
  if (
    h.wind > LIMITS.windMarginal ||
    h.gust > LIMITS.gustMarginal ||
    h.precipProb >= LIMITS.precipProbBad ||
    h.precip > 0.5 ||
    isPrecipCode(h.code)
  ) {
    return "uygunsuz";
  }
  if (
    h.wind > LIMITS.windGood ||
    h.gust > LIMITS.gustGood ||
    h.precipProb >= LIMITS.precipProbMarginal ||
    h.visibility < LIMITS.visibilityMarginal
  ) {
    return "dikkatli";
  }
  return "uygun";
}

const RANK: Record<Verdict, number> = { uygun: 0, dikkatli: 1, uygunsuz: 2 };

/** Gün boyunca gündüz saatlerinin en iyi durumunu özetler */
function dayVerdict(hours: HourPoint[]): Verdict {
  const day = hours.filter((h) => h.isDay);
  if (!day.length) return "uygunsuz";
  // Günün EN İYİ saati günün genel verdictini belirler (uçuş penceresi aranıyor)
  return day.reduce<Verdict>(
    (best, h) => (RANK[hourVerdict(h)] < RANK[best] ? hourVerdict(h) : best),
    "uygunsuz"
  );
}

/** Gündüz saatlerinde en uzun "uygun" bloğu bulur */
function findBestWindow(hours: HourPoint[]) {
  const day = hours.filter((h) => h.isDay);
  let best: { from: string; to: string; wind: number } | null = null;
  let run: HourPoint[] = [];

  const flush = () => {
    if (run.length >= 2) {
      const avgWind = run.reduce((a, h) => a + h.wind, 0) / run.length;
      const span = run.length;
      const bestSpan = best
        ? (new Date(best.to).getTime() - new Date(best.from).getTime()) / 3600000 + 1
        : 0;
      if (!best || span > bestSpan) {
        best = {
          from: run[0].time,
          to: run[run.length - 1].time,
          wind: avgWind,
        };
      }
    }
    run = [];
  };

  for (const h of day) {
    if (hourVerdict(h) === "uygun") run.push(h);
    else flush();
  }
  flush();
  return best;
}

/* ---------- API ---------- */
interface ApiResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    cloud_cover: number[];
    visibility: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
    weather_code: number[];
  };
}

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/**
 * 5 günlük tahmini çeker ve uçuş planlaması için işler.
 * Rüzgâr m/s cinsinden istenir (wind_speed_unit=ms).
 */
export async function fetchForecast(
  lat = FLIGHT_SITE.lat,
  lon = FLIGHT_SITE.lon,
  days = 5
): Promise<DayForecast[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly:
      "temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,precipitation,cloud_cover,visibility,weather_code,is_day",
    daily:
      "temperature_2m_min,temperature_2m_max,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max,sunrise,sunset,weather_code",
    wind_speed_unit: "ms",
    timezone: "Europe/Istanbul",
    forecast_days: String(days),
  });

  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) {
    throw new Error(`Hava durumu alınamadı (HTTP ${res.status})`);
  }
  const data = (await res.json()) as ApiResponse;

  const hoursByDay = new Map<string, HourPoint[]>();
  data.hourly.time.forEach((t, i) => {
    const day = t.slice(0, 10);
    const point: HourPoint = {
      time: t,
      temp: data.hourly.temperature_2m[i],
      wind: data.hourly.wind_speed_10m[i],
      gust: data.hourly.wind_gusts_10m[i],
      dir: data.hourly.wind_direction_10m[i],
      precipProb: data.hourly.precipitation_probability[i] ?? 0,
      precip: data.hourly.precipitation[i] ?? 0,
      cloud: data.hourly.cloud_cover[i] ?? 0,
      visibility: data.hourly.visibility?.[i] ?? 10000,
      code: data.hourly.weather_code[i],
      isDay: data.hourly.is_day[i] === 1,
    };
    const arr = hoursByDay.get(day);
    if (arr) arr.push(point);
    else hoursByDay.set(day, [point]);
  });

  return data.daily.time.map((date, i) => {
    const hours = hoursByDay.get(date) ?? [];
    return {
      date,
      tempMin: data.daily.temperature_2m_min[i],
      tempMax: data.daily.temperature_2m_max[i],
      windMax: data.daily.wind_speed_10m_max[i],
      gustMax: data.daily.wind_gusts_10m_max[i],
      precipSum: data.daily.precipitation_sum[i] ?? 0,
      precipProbMax: data.daily.precipitation_probability_max[i] ?? 0,
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
      code: data.daily.weather_code[i],
      hours,
      verdict: dayVerdict(hours),
      bestWindow: findBestWindow(hours),
    };
  });
}
