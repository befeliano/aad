/* ============================================================
   weather.js — Hava durumu (Open-Meteo)
   ============================================================ */

import { $, warn } from './helpers.js';
import { showToast } from '../ui/components.js';

let windUnit = 'kmh';
let weatherCache = null;
let currentLocation = { name: 'Eskişehir', lat: 39.7767, lon: 30.5206 };

const WMO = {
  0:  { icon: '☀',  text: 'Açık' }, 1:  { icon: '🌤', text: 'Az bulutlu' },
  2:  { icon: '⛅', text: 'Parçalı bulutlu' }, 3:  { icon: '☁',  text: 'Kapalı' },
  45: { icon: '🌫', text: 'Sisli' }, 48: { icon: '🌫', text: 'Don sisli' },
  51: { icon: '🌦', text: 'Hafif çisenti' }, 53: { icon: '🌦', text: 'Çisenti' },
  55: { icon: '🌦', text: 'Yoğun çisenti' }, 61: { icon: '🌧', text: 'Hafif yağmur' },
  63: { icon: '🌧', text: 'Yağmur' }, 65: { icon: '🌧', text: 'Şiddetli yağmur' },
  71: { icon: '🌨', text: 'Hafif kar' }, 73: { icon: '🌨', text: 'Kar' },
  75: { icon: '❄',  text: 'Yoğun kar' }, 77: { icon: '🌨', text: 'Kar taneleri' },
  80: { icon: '🌦', text: 'Sağanak' }, 81: { icon: '🌧', text: 'Sağanak yağış' },
  82: { icon: '⛈', text: 'Şiddetli sağanak' }, 85: { icon: '🌨', text: 'Kar sağanağı' },
  86: { icon: '🌨', text: 'Yoğun kar sağanağı' }, 95: { icon: '⛈', text: 'Gök gürültülü fırtına' },
  96: { icon: '⛈', text: 'Dolu eşliğinde fırtına' }, 99: { icon: '⛈', text: 'Şiddetli fırtına' }
};
const wmo = (c) => WMO[c] || { icon: '🌡', text: 'Bilinmiyor' };

const degToCompass = (deg) => {
  if (deg == null || isNaN(deg)) return '—';
  const dirs = ['K','KKD','KD','DKD','D','DGD','GD','GGD','G','GGB','GB','BGB','B','BKB','KB','KKB'];
  return dirs[Math.round(deg / 22.5) % 16];
};
const formatWind = (kmh) =>
  kmh == null ? '--' : (windUnit === 'kn' ? (kmh * 0.539957).toFixed(1) : kmh.toFixed(1));
const interp50m = (v10, v80) =>
  (v10 == null || v80 == null) ? v10 : v10 + (v80 - v10) * ((50 - 10) / (80 - 10));

async function geocode(q) {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr&format=json`
  );
  const d = await r.json();
  if (d.results?.[0]) {
    const x = d.results[0];
    return { name: x.name + (x.admin1 ? ', ' + x.admin1 : ''), lat: x.latitude, lon: x.longitude };
  }
  return null;
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m` +
    `&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_speed_80m,wind_direction_80m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_sum` +
    `&wind_speed_unit=kmh&timezone=auto&forecast_days=5`;
  const data = await (await fetch(url)).json();
  data._fetchedAt = Date.now();
  return data;
}

function updateWeatherBar(data) {
  if (!data?.current) return;
  const c = data.current;
  const w = wmo(c.weather_code);
  $('wx-icon').textContent = w.icon;
  $('wx-cond').textContent = w.text;
  $('wx-temp').textContent = Math.round(c.temperature_2m);
  $('wx-humidity').textContent = Math.round(c.relative_humidity_2m);
  $('wx-loc').textContent = currentLocation.name;
  $('wx-wind-ground').textContent = formatWind(c.wind_speed_10m);
  $('wx-wind-ground-unit').textContent = windUnit === 'kn' ? 'kn' : 'km/h';
  $('wx-wind-ground-dir').textContent = degToCompass(c.wind_direction_10m);

  let wind50 = null, dir50 = null;
  if (data.hourly) {
    const idx = Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= new Date()) - 1);
    wind50 = interp50m(data.hourly.wind_speed_10m[idx], data.hourly.wind_speed_80m[idx]);
    dir50  = data.hourly.wind_direction_80m[idx] ?? data.hourly.wind_direction_10m[idx];
  }
  $('wx-wind-50').textContent = formatWind(wind50);
  $('wx-wind-50-unit').textContent = windUnit === 'kn' ? 'kn' : 'km/h';
  $('wx-wind-50-dir').textContent = degToCompass(dir50);
}

function renderForecast(data) {
  if (!data?.daily) return;
  const days = data.daily;
  $('forecast').innerHTML = days.time.map((dt, i) => {
    const d = new Date(dt);
    const w = wmo(days.weather_code[i]);
    return `
      <div class="fc-card${i === 0 ? ' is-today' : ''}">
        <div class="fc-day">${i === 0 ? 'BUGÜN' : d.toLocaleDateString('tr-TR',{weekday:'long'})}</div>
        <div class="fc-date">${d.getDate()} ${d.toLocaleDateString('tr-TR',{month:'short'})}</div>
        <div class="fc-icon">${w.icon}</div>
        <div class="fc-temp">${Math.round(days.temperature_2m_max[i])}°<span class="fc-temp__low">${Math.round(days.temperature_2m_min[i])}°</span></div>
        <div class="fc-cond">${w.text}</div>
        <div class="fc-detail"><span>RÜZGAR</span><span>${formatWind(days.wind_speed_10m_max[i])} ${windUnit==='kn'?'kn':'km/h'} ${degToCompass(days.wind_direction_10m_dominant[i])}</span></div>
        <div class="fc-detail"><span>YAĞIŞ</span><span>${(days.precipitation_sum[i]||0).toFixed(1)} mm</span></div>
      </div>`;
  }).join('');
}

function renderHourly(data) {
  if (!data?.hourly) return;
  const h = data.hourly;
  const start = h.time.findIndex(t => new Date(t) >= new Date());
  const slice = Array.from({length:24}, (_,k) => start+k).filter(i => i < h.time.length);
  $('hourly').innerHTML = slice.map(i => {
    const t = new Date(h.time[i]);
    const w = wmo(h.weather_code[i]);
    return `
      <div class="h-cell">
        <div class="h-time">${t.getHours().toString().padStart(2,'0')}:00</div>
        <div class="h-icon">${w.icon}</div>
        <div class="h-temp">${Math.round(h.temperature_2m[i])}°</div>
        <div class="h-wind">${formatWind(h.wind_speed_10m[i])} ${degToCompass(h.wind_direction_10m[i])}</div>
      </div>`;
  }).join('');
}

export async function loadWeather() {
  try {
    weatherCache = await fetchWeather(currentLocation.lat, currentLocation.lon);
    updateWeatherBar(weatherCache);
    renderForecast(weatherCache);
    renderHourly(weatherCache);
  } catch (e) {
    warn('weather fetch failed:', e);
    $('wx-cond').textContent = 'Veri alınamadı';
  }
}

/* Event bindings — DOM hazır olunca app.js'den çağrılır */
export function initWeather() {
  document.querySelectorAll('.unit-toggle__btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.unit-toggle__btn').forEach(x =>
        x.classList.toggle('is-active', x === b)
      );
      windUnit = b.dataset.unit;
      if (weatherCache) {
        updateWeatherBar(weatherCache);
        renderForecast(weatherCache);
        renderHourly(weatherCache);
      }
    });
  });

  $('locSearch')?.addEventListener('click', async () => {
    const q = $('locInput').value.trim();
    if (!q) return;
    const loc = await geocode(q);
    if (loc) {
      currentLocation = loc;
      loadWeather();
    } else {
      showToast('Konum bulunamadı', 'error');
    }
  });

  $('locMe')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      return showToast('Tarayıcınız konum servisini desteklemiyor', 'error');
    }
    if (location.protocol === 'http:' && location.hostname !== 'localhost') {
      return showToast('Konum servisi sadece HTTPS üzerinde çalışır', 'error');
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLocation = {
          name: 'Mevcut Konum',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        loadWeather();
      },
      (e) => {
        const msg = e.code === 1 ? 'Konum izni reddedildi'
                  : e.code === 2 ? 'Konum belirlenemedi'
                  : e.code === 3 ? 'Konum isteği zaman aşımına uğradı'
                  : 'Konum alınamadı';
        showToast(msg, 'error');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && weatherCache) {
      const ageMs = Date.now() - (weatherCache._fetchedAt || 0);
      if (ageMs > 5 * 60 * 1000) loadWeather();
    }
  });

  // İlk yükleme + 10 dakikada bir tazeleme
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);
}