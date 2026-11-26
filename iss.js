'use strict';

// Position der Internationalen Raumstation (ISS).
// Die Bahnelemente (TLE) kommen von CelesTrak und werden in chrome.storage.local
// zwischengespeichert. Die Position wird daraus lokal berechnet (Kepler-Bahn mit
// säkularen J2-Störungen und Abbremsung durch die Atmosphäre). Für frische
// Bahnelemente ist das auf wenige Kilometer bis einige zehn Kilometer genau.

const ISS_TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const ISS_TLE_TTL = 6 * 3600 * 1000;          // nach 6 Stunden neue Bahnelemente holen
const ISS_TLE_MAX_AGE = 7 * 24 * 3600 * 1000; // ältere Bahnelemente sind zu ungenau
const ISS_CACHE_KEY = 'issTle';

const EARTH_MU = 398600.4418;   // km³/s²
const EARTH_R = 6378.137;       // km (Äquatorradius)
const EARTH_J2 = 1.08262668e-3;
const EARTH_F = 1 / 298.257223563;

// Zerlegt die beiden Datenzeilen eines TLE in Bahnelemente.
function parseTle(line1, line2) {
  const num = s => parseFloat(s.trim());
  const yy = parseInt(line1.slice(18, 20), 10);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const dayOfYear = num(line1.slice(20, 32));
  const epoch = Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86400000;
  const el = {
    epoch,
    ndot: num(line1.slice(33, 43)),             // halbe Ableitung der mittleren Bewegung, U/Tag²
    incl: num(line2.slice(8, 16)),
    raan: num(line2.slice(17, 25)),
    ecc: parseFloat('0.' + line2.slice(26, 33).trim()),
    argp: num(line2.slice(34, 42)),
    m0: num(line2.slice(43, 51)),
    n: num(line2.slice(52, 63)),                // Umläufe pro Tag
  };
  return Object.values(el).every(Number.isFinite) && el.n > 0 ? el : null;
}

// Subsatellitenpunkt (geodätische Breite, Länge) und Bahnhöhe in km zum Zeitpunkt t (ms).
function issPosition(el, t) {
  const rad = Math.PI / 180;
  const dtDays = (t - el.epoch) / 86400000;
  const n = el.n * 2 * Math.PI / 86400;                 // rad/s
  const a = Math.cbrt(EARTH_MU / (n * n));
  const e = el.ecc;
  const i = el.incl * rad;
  const p = a * (1 - e * e);
  const k = 1.5 * EARTH_J2 * (EARTH_R / p) ** 2 * n * 86400;   // rad/Tag
  const sinI2 = Math.sin(i) ** 2;

  const raan = el.raan * rad - k * Math.cos(i) * dtDays;
  const argp = el.argp * rad + k * (2 - 2.5 * sinI2) * dtDays;
  const revs = el.m0 / 360 + el.n * dtDays + el.ndot * dtDays * dtDays;
  const M = (revs % 1) * 2 * Math.PI + k * Math.sqrt(1 - e * e) * (1 - 1.5 * sinI2) * dtDays;

  // Kepler-Gleichung lösen
  let E = M;
  for (let j = 0; j < 8; j++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e);
  const r = a * (1 - e * Math.cos(E));
  const u = argp + nu;

  // Bahnebene -> inertiales Äquatorsystem
  const x = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(i));
  const y = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(i));
  const z = r * Math.sin(u) * Math.sin(i);

  // Erddrehung (Sternzeit Greenwich)
  const jd2000 = t / 86400000 - 10957.5;
  const gmst = (280.46061837 + 360.98564736629 * jd2000) * rad;
  let lon = (Math.atan2(y, x) - gmst) / rad;
  lon = ((lon % 360) + 540) % 360 - 180;

  // Geodätische Breite (WGS84), iterativ
  const rxy = Math.hypot(x, y);
  const e2 = EARTH_F * (2 - EARTH_F);
  let lat = Math.atan2(z, rxy), N = EARTH_R;
  for (let j = 0; j < 4; j++) {
    N = EARTH_R / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    lat = Math.atan2(z + e2 * N * Math.sin(lat), rxy);
  }
  const alt = rxy / Math.cos(lat) - N;
  return { lat: lat / rad, lon, alt };
}

// Bahnspur von t0 bis t1 als Liste von [lon, lat]; Abstand step in ms.
function issTrack(el, t0, t1, step = 30000) {
  const pts = [];
  for (let t = t0; t <= t1; t += step) {
    const p = issPosition(el, t);
    pts.push([p.lon, p.lat]);
  }
  return pts;
}

// Liefert die Bahnelemente aus dem Cache oder lädt sie neu. null, wenn keine brauchbaren vorliegen.
async function fetchIssTle() {
  const hasLocal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  let cached = null;
  try {
    cached = hasLocal
      ? (await chrome.storage.local.get(ISS_CACHE_KEY))[ISS_CACHE_KEY]
      : JSON.parse(localStorage.getItem(ISS_CACHE_KEY));
  } catch { /* Cache ist optional */ }

  const now = Date.now();
  if (cached && now - cached.ts < ISS_TLE_TTL) return parseTle(cached.line1, cached.line2);

  try {
    const res = await fetch(ISS_TLE_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const lines = (await res.text()).split(/\r?\n/).map(l => l.trimEnd());
    const line1 = lines.find(l => l.startsWith('1 '));
    const line2 = lines.find(l => l.startsWith('2 '));
    if (!line1 || !line2 || !parseTle(line1, line2)) throw new Error('Ungültige Bahnelemente');
    const entry = { line1, line2, ts: now };
    try {
      if (hasLocal) await chrome.storage.local.set({ [ISS_CACHE_KEY]: entry });
      else localStorage.setItem(ISS_CACHE_KEY, JSON.stringify(entry));
    } catch { /* Cache ist optional */ }
    return parseTle(line1, line2);
  } catch (e) {
    console.warn('ISS-Bahndaten konnten nicht geladen werden:', e);
    // Notfalls ältere Bahnelemente weiterverwenden, solange sie nicht zu alt sind.
    const el = cached && parseTle(cached.line1, cached.line2);
    return el && Math.abs(now - el.epoch) < ISS_TLE_MAX_AGE ? el : null;
  }
}
