'use strict';

// Erdbeben der letzten 24 Stunden aus den GeoJSON-Feeds des USGS (kostenlos, ohne API-Schlüssel).
// Die Feeds gibt es nur mit festen Untergrenzen (M 2,5 und M 4,5); die eingestellte
// Mindeststärke wird deshalb beim Zeichnen gefiltert. Ergebnisse werden in
// chrome.storage.local zwischengespeichert, damit nicht jeder neue Tab eine Anfrage auslöst.

const QUAKE_TTL = 10 * 60 * 1000;   // Cache-Gültigkeit (USGS aktualisiert die Feeds minütlich)
const QUAKE_CACHE_KEY = 'quakeCache';
const QUAKE_WINDOW = 24 * 3600 * 1000;

// Kleinster Feed, der alle Beben ab der Mindeststärke enthält.
const quakeFeed = minMag => (minMag >= 4.5 ? '4.5_day' : '2.5_day');

// Liefert die Beben als Liste { id, lat, lon, depth, mag, place, time }.
// Bei Fehlern (z. B. offline) werden die zuletzt geladenen Daten weiterverwendet.
async function fetchQuakes(minMag) {
  const feed = quakeFeed(minMag);
  const hasLocal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  let cached = null;
  try {
    cached = hasLocal
      ? (await chrome.storage.local.get(QUAKE_CACHE_KEY))[QUAKE_CACHE_KEY]
      : JSON.parse(localStorage.getItem(QUAKE_CACHE_KEY));
  } catch { /* Cache ist optional */ }
  if (cached && cached.feed !== feed) cached = null;

  const now = Date.now();
  if (cached && now - cached.ts < QUAKE_TTL) return cached.quakes;

  try {
    const res = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const quakes = (data.features || []).flatMap(f => {
      const p = f.properties || {};
      const [lon, lat, depth] = (f.geometry && f.geometry.coordinates) || [];
      if (![lon, lat, p.mag, p.time].every(Number.isFinite)) return [];
      return [{ id: f.id, lat, lon, depth: Number.isFinite(depth) ? depth : null, mag: p.mag, place: p.place || '', time: p.time }];
    });
    const entry = { feed, quakes, ts: now };
    try {
      if (hasLocal) await chrome.storage.local.set({ [QUAKE_CACHE_KEY]: entry });
      else localStorage.setItem(QUAKE_CACHE_KEY, JSON.stringify(entry));
    } catch { /* Cache ist optional */ }
    return quakes;
  } catch (e) {
    console.warn('Erdbebendaten konnten nicht geladen werden:', e);
    return cached ? cached.quakes : [];
  }
}
