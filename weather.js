'use strict';

// Aktuelles Wetter je Stadt über Open-Meteo (kostenlos, ohne API-Schlüssel).
// Ergebnisse werden in chrome.storage.local zwischengespeichert, damit nicht
// jeder neue Tab eine Anfrage auslöst.

const WEATHER_TTL = 15 * 60 * 1000;   // Cache-Gültigkeit
const WEATHER_CACHE_KEY = 'weatherCache';
const hasLocalStorageArea = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

const weatherKey = c => `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;

async function readWeatherCache() {
  try {
    if (hasLocalStorageArea) return (await chrome.storage.local.get(WEATHER_CACHE_KEY))[WEATHER_CACHE_KEY] || {};
    return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)) || {};
  } catch { return {}; }
}

async function writeWeatherCache(cache) {
  // Veraltete Einträge verwerfen, damit der Cache nicht unbegrenzt wächst.
  const now = Date.now();
  for (const k of Object.keys(cache)) if (now - cache[k].ts > 24 * 3600 * 1000) delete cache[k];
  try {
    if (hasLocalStorageArea) await chrome.storage.local.set({ [WEATHER_CACHE_KEY]: cache });
    else localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch { /* Cache ist optional */ }
}

// Liefert eine Map key -> { temp, code, day } für alle Städte.
// Frische Werte kommen aus dem Cache, der Rest wird in einer Sammelanfrage geholt.
async function fetchWeather(cities) {
  const cache = await readWeatherCache();
  const now = Date.now();
  const unique = new Map();
  for (const c of cities) unique.set(weatherKey(c), c);

  const stale = [...unique.entries()].filter(([k]) => !cache[k] || now - cache[k].ts > WEATHER_TTL);

  // In Blöcken anfragen, um die URL-Länge zu begrenzen.
  for (let i = 0; i < stale.length; i += 50) {
    const chunk = stale.slice(i, i + 50);
    const url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + chunk.map(([, c]) => c.lat.toFixed(2)).join(',')
      + '&longitude=' + chunk.map(([, c]) => c.lon.toFixed(2)).join(',')
      + '&current=temperature_2m,weather_code,is_day&timezone=GMT';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let data = await res.json();
      if (!Array.isArray(data)) data = [data];
      data.forEach((d, j) => {
        const cur = d && d.current;
        if (!cur || cur.temperature_2m == null) return;
        cache[chunk[j][0]] = { temp: cur.temperature_2m, code: cur.weather_code, day: cur.is_day === 1, ts: now };
      });
    } catch (e) {
      console.warn('Wetterdaten konnten nicht geladen werden:', e);
    }
  }

  if (stale.length) await writeWeatherCache(cache);

  const out = new Map();
  for (const k of unique.keys()) if (cache[k]) out.set(k, cache[k]);
  return out;
}

// WMO-Wettercode -> Symboltyp
function weatherKind(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  if (code >= 51 && code <= 82) return 'rain';
  return 'cloudy';
}

const WEATHER_LABELS = {
  clear: 'klar', partly: 'teils bewölkt', cloudy: 'bewölkt', fog: 'Nebel',
  rain: 'Regen', snow: 'Schnee', thunder: 'Gewitter',
};

// Zeichnet ein kleines Wettersymbol der Größe s mit linker oberer Ecke (x, y).
// colors: { sun, moon, cloud, rain, bolt }
function drawWeatherIcon(ctx, kind, day, x, y, s, colors) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);   // Symbole sind auf einem 16×16-Raster entworfen
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sunOrMoon = (cx, cy, r) => {
    if (day) {
      ctx.fillStyle = colors.sun;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.sun;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.moveTo(cx + Math.cos(a) * (r + 1.6), cy + Math.sin(a) * (r + 1.6));
        ctx.lineTo(cx + Math.cos(a) * (r + 3.2), cy + Math.sin(a) * (r + 3.2));
      }
      ctx.stroke();
    } else {
      // Mondsichel
      ctx.fillStyle = colors.moon;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.9, cy - r * 0.7, r + 0.8, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }
  };

  const cloud = (ox = 0, oy = 0, k = 1) => {
    ctx.fillStyle = colors.cloud;
    ctx.beginPath();
    ctx.arc(ox + 5 * k, oy + 10 * k, 3 * k, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(ox + 8 * k, oy + 7 * k, 4 * k, Math.PI * 1.05, Math.PI * 1.95);
    ctx.arc(ox + 11.5 * k, oy + 9.5 * k, 3.5 * k, Math.PI * 1.4, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
  };

  switch (kind) {
    case 'clear':
      sunOrMoon(8, 8, 3.6);
      break;
    case 'partly':
      sunOrMoon(5.5, 5.5, 2.8);
      cloud(1.5, 2.5, 0.9);
      break;
    case 'cloudy':
      cloud(0, 0.5);
      break;
    case 'fog':
      ctx.strokeStyle = colors.cloud;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(2, 5); ctx.lineTo(14, 5);
      ctx.moveTo(1, 8.5); ctx.lineTo(12, 8.5);
      ctx.moveTo(4, 12); ctx.lineTo(15, 12);
      ctx.stroke();
      break;
    case 'rain':
      cloud(0, -2);
      ctx.strokeStyle = colors.rain;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const dx of [5, 8.5, 12]) { ctx.moveTo(dx, 11.5); ctx.lineTo(dx - 1.2, 15); }
      ctx.stroke();
      break;
    case 'snow':
      cloud(0, -2);
      ctx.fillStyle = colors.moon;
      for (const [dx, dy] of [[5, 13], [8.5, 14.5], [12, 13]]) {
        ctx.beginPath(); ctx.arc(dx, dy, 1.2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'thunder':
      cloud(0, -2);
      ctx.fillStyle = colors.bolt;
      ctx.beginPath();
      ctx.moveTo(9, 10); ctx.lineTo(6, 13.5); ctx.lineTo(8.3, 13.5);
      ctx.lineTo(7, 16); ctx.lineTo(11, 12); ctx.lineTo(8.7, 12); ctx.lineTo(10, 10);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}
