'use strict';

// Polarlicht-Vorhersage (OVATION-Modell) des NOAA Space Weather Prediction Center.
// Der Feed liefert für ein 1°-Raster die Wahrscheinlichkeit (0–100 %), dass dort in
// den nächsten 30–90 Minuten Polarlicht zu sehen ist. Er ist rund 900 KB groß; im
// Cache (chrome.storage.local) liegt das Raster deshalb kompakt als Zeichenkette.

const AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const AURORA_TTL = 10 * 60 * 1000;   // NOAA rechnet etwa alle 5 Minuten neu
const AURORA_CACHE_KEY = 'auroraCache';
const AURORA_W = 360;   // Längen 0…359° O
const AURORA_H = 181;   // Breiten −90…90°

// Index im Raster: Länge 0…359 (östlich), Breite −90…90.
const auroraIndex = (lon, lat) => (((Math.round(lon) % 360) + 360) % 360) * AURORA_H + Math.round(lat) + 90;

// Wahrscheinlichkeit in Prozent an einem Ort, 0 außerhalb des Rasters.
function auroraAt(aurora, lat, lon) {
  if (!aurora || lat < -90 || lat > 90) return 0;
  return aurora.grid[auroraIndex(lon, lat)] || 0;
}

// Je Rasterpunkt ein Zeichen (Wert + 32). In Blöcken, weil fromCharCode nicht beliebig viele Argumente verträgt.
function encodeGrid(grid) {
  let s = '';
  for (let i = 0; i < grid.length; i += 4096) {
    s += String.fromCharCode(...Array.from(grid.subarray(i, i + 4096), v => 32 + v));
  }
  return s;
}
const decodeGrid = s => Uint8Array.from(s, ch => ch.charCodeAt(0) - 32);

// Liefert { grid: Uint8Array, forecast: ms } oder null, wenn keine Daten vorliegen.
// Bei Fehlern (z. B. offline) wird die letzte Vorhersage weiterverwendet, solange sie höchstens 3 h alt ist.
async function fetchAurora() {
  const hasLocal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  let cached = null;
  try {
    cached = hasLocal
      ? (await chrome.storage.local.get(AURORA_CACHE_KEY))[AURORA_CACHE_KEY]
      : JSON.parse(localStorage.getItem(AURORA_CACHE_KEY));
  } catch { /* Cache ist optional */ }
  const fromCache = () => ({ grid: decodeGrid(cached.grid), forecast: cached.forecast });

  const now = Date.now();
  if (cached && now - cached.ts < AURORA_TTL) return fromCache();

  try {
    const res = await fetch(AURORA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const grid = new Uint8Array(AURORA_W * AURORA_H);
    let n = 0;
    for (const p of data.coordinates || []) {
      const [lon, lat, v] = p;
      if (![lon, lat, v].every(Number.isFinite) || lat < -90 || lat > 90) continue;
      grid[auroraIndex(lon, lat)] = Math.max(0, Math.min(100, Math.round(v)));
      n++;
    }
    if (!n) throw new Error('Leere Vorhersage');
    const forecast = Date.parse(data['Forecast Time']) || now;
    const entry = { grid: encodeGrid(grid), forecast, ts: now };
    try {
      if (hasLocal) await chrome.storage.local.set({ [AURORA_CACHE_KEY]: entry });
      else localStorage.setItem(AURORA_CACHE_KEY, JSON.stringify(entry));
    } catch { /* Cache ist optional */ }
    return { grid, forecast };
  } catch (e) {
    console.warn('Polarlicht-Vorhersage konnte nicht geladen werden:', e);
    return cached && now - cached.forecast < 3 * 3600 * 1000 ? fromCache() : null;
  }
}
