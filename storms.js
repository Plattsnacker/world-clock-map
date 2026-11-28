'use strict';

// Tropische Wirbelstürme vom Global Disaster Alert and Coordination System (GDACS,
// Gemeinschaftsprojekt von UN und EU-Kommission). Die Ereignisliste nennt alle Stürme der
// letzten Wochen; für jeden aktiven Sturm wird zusätzlich die Geometrie geladen
// (beobachtete Zugbahn, Vorhersagepunkte, Unsicherheitskegel). Die Geometrie ist mehrere
// Hundert KB groß, deshalb liegt im Cache (chrome.storage.local) nur ein kompakter Auszug.

const STORM_TTL = 30 * 60 * 1000;   // GDACS aktualisiert etwa alle 3 bis 6 Stunden
const STORM_CACHE_KEY = 'stormCache';
const STORM_LIST_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC';
const stormGeometryUrl = (id, episode) =>
  `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${id}&episodeid=${episode}`;
// Auch Stürme zeigen, deren letzte Meldung höchstens so alt ist (falls iscurrent fehlt).
const STORM_RECENT = 12 * 3600 * 1000;

// Zeitangaben von GDACS sind UTC ohne Zonenangabe.
const parseUtc = s => (typeof s === 'string' && s ? Date.parse(s.endsWith('Z') ? s : s + 'Z') : NaN);
const round1 = v => Math.round(v * 10) / 10;

// Mittelpunkt eines Rings (ohne den schließenden Wiederholungspunkt).
function ringCenter(ring) {
  const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.length - 1 : ring.length;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}

// Kategorie der Zugbahn: TD (Tiefdruckgebiet), TS (Sturm), alles darüber als HU (Hurrikan/Taifun).
const stormCategory = label => (label === 'TD' ? 'TD' : label === 'TS' ? 'TS' : label ? 'HU' : '');

// Wandelt die Geometrie eines Sturms in { advisory, points: [[lon, lat, t, cat, fc]], cone: [ring] } um.
// fc = 1 für Vorhersagepunkte (Zeitpunkt nach der letzten Meldung).
function parseStormGeometry(data, startYear, startMonth) {
  const features = (data && data.features) || [];
  const catAt = new Map();   // "lon,lat" (0,1°) des Segment-Endpunkts → Kategorie
  const raw = [];
  const cone = [];
  let advisory = 0;
  for (const f of features) {
    const p = f.properties || {};
    const g = f.geometry || {};
    if (g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const [lon, lat] = g.coordinates[g.coordinates.length - 1];
      catAt.set(`${round1(lon)},${round1(lat)}`, stormCategory(p.polygonlabel));
    } else if (p.featuretype === 'PointRadii' && g.type === 'Polygon' && /^\d{8}$/.test(p.key || '')) {
      const [lon, lat] = ringCenter(g.coordinates[0]);
      const k = p.key;   // MMTTHHMM in UTC; das Jahr ergibt sich aus dem Beginn des Sturms
      const month = +k.slice(0, 2);
      const year = startYear + (month < startMonth ? 1 : 0);
      const t = Date.UTC(year, month - 1, +k.slice(2, 4), +k.slice(4, 6), +k.slice(6, 8));
      raw.push([lon, lat, t]);
      advisory = Math.max(advisory, parseUtc(p.polygondate) || 0);
    } else if (p.Class === 'Poly_Cones') {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        // Nur der äußere Ring, auf 0,1° gerundet und ohne doppelte Punkte.
        const ring = [];
        for (const [lon, lat] of poly[0] || []) {
          const q = [round1(lon), round1(lat)];
          const last = ring[ring.length - 1];
          if (!last || last[0] !== q[0] || last[1] !== q[1]) ring.push(q);
        }
        if (ring.length >= 3) cone.push(ring);
      }
    }
  }
  raw.sort((a, b) => a[2] - b[2]);
  const points = raw.map(([lon, lat, t]) => [
    round1(lon), round1(lat), t, catAt.get(`${round1(lon)},${round1(lat)}`) || '', advisory && t > advisory ? 1 : 0,
  ]);
  return { advisory, points, cone };
}

// Liefert die aktiven Stürme als Liste
// { id, name, alert, wind, advisory, lon, lat, cat, points, cone }.
// Bei Fehlern (z. B. offline) werden die zuletzt geladenen Daten weiterverwendet.
async function fetchStorms() {
  const hasLocal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  let cached = null;
  try {
    cached = hasLocal
      ? (await chrome.storage.local.get(STORM_CACHE_KEY))[STORM_CACHE_KEY]
      : JSON.parse(localStorage.getItem(STORM_CACHE_KEY));
  } catch { /* Cache ist optional */ }

  const now = Date.now();
  if (cached && now - cached.ts < STORM_TTL) return cached.storms;

  try {
    const res = await fetch(STORM_LIST_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const list = await res.json();
    const active = (list.features || []).filter(f => {
      const p = f.properties || {};
      return p.eventtype === 'TC' && (String(p.iscurrent) === 'true' || now - parseUtc(p.todate) < STORM_RECENT);
    });

    const storms = await Promise.all(active.map(async f => {
      const p = f.properties;
      const start = new Date(parseUtc(p.fromdate) || now);
      const [lon0, lat0] = (f.geometry && f.geometry.coordinates) || [];
      let geo = { advisory: parseUtc(p.todate) || 0, points: [], cone: [] };
      try {
        const r = await fetch(stormGeometryUrl(p.eventid, p.episodeid));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        geo = parseStormGeometry(await r.json(), start.getUTCFullYear(), start.getUTCMonth() + 1);
      } catch (e) {
        console.warn(`Zugbahn von ${p.eventname} konnte nicht geladen werden:`, e);
      }
      // Aktuelle Position: letzter Punkt bis zur letzten Meldung, sonst der Mittelpunkt aus der Liste.
      const past = geo.points.filter(q => !q[4]);
      const cur = past[past.length - 1];
      const lon = cur ? cur[0] : lon0, lat = cur ? cur[1] : lat0;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      const wind = p.severitydata && Number(p.severitydata.severity);
      return {
        id: p.eventid,
        name: String(p.eventname || p.name || '').replace(/-\d+$/, ''),
        alert: String(p.alertlevel || '').toLowerCase(),
        wind: Number.isFinite(wind) && wind > 0 ? Math.round(wind) : null,
        advisory: geo.advisory || parseUtc(p.todate) || null,
        lon, lat,
        // Kategorie des jüngsten beobachteten Abschnitts, für den GDACS eine angibt.
        cat: (past.findLast(q => q[3]) || [])[3] || '',
        points: geo.points,
        cone: geo.cone,
      };
    }));

    const entry = { storms: storms.filter(Boolean), ts: now };
    try {
      if (hasLocal) await chrome.storage.local.set({ [STORM_CACHE_KEY]: entry });
      else localStorage.setItem(STORM_CACHE_KEY, JSON.stringify(entry));
    } catch { /* Cache ist optional */ }
    return entry.storms;
  } catch (e) {
    console.warn('Wirbelsturmdaten konnten nicht geladen werden:', e);
    return cached ? cached.storms : [];
  }
}
