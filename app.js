'use strict';

// Sichtbarer Breitenbereich der Karte (Antarktis wird abgeschnitten).
const LAT_MAX = 84;
const LAT_MIN = -60;
const LAT_RANGE = LAT_MAX - LAT_MIN;

// Wird beim Start und bei Änderungen in den Einstellungen aus dem Speicher geladen (cities.js).
let CITIES = resolveCities(DEFAULT_SETTINGS);
let SHOW_WEATHER = DEFAULT_SETTINGS.showWeather;
let SHOW_SUN = DEFAULT_SETTINGS.showSun;
let SHOW_MOON = DEFAULT_SETTINGS.showMoon;
let SHOW_FLAGS = DEFAULT_SETTINGS.showFlags;
let CENTER_NOON = DEFAULT_SETTINGS.centerNoon;
let SHOW_ISS = DEFAULT_SETTINGS.showIss;
let TEMP_UNIT = DEFAULT_SETTINGS.tempUnit;
let CLOCK = DEFAULT_SETTINGS.clock;
let SHOW_QUAKES = DEFAULT_SETTINGS.showQuakes;
let QUAKE_MIN_MAG = DEFAULT_SETTINGS.quakeMinMag;
let SHOW_AURORA = DEFAULT_SETTINGS.showAurora;
let SHOW_GRID = DEFAULT_SETTINGS.showGrid;
let weather = new Map();   // weatherKey(city) -> { temp, code, day } (weather.js)
let weatherLoadedAt = 0;

// Canvas-Farben, abgeleitet aus dem aktiven Theme (themes.js).
let COLORS = canvasColors(resolveTheme(DEFAULT_THEME_STATE));

function canvasColors(t) {
  const dark = luminance(t.bg) < 0.4;
  return {
    oceanTop: t.oceanTop,
    oceanBottom: t.oceanBottom,
    land: t.land,
    border: rgba(t.border, dark ? 0.25 : 0.45),
    band: rgba(t.text, 0.025),
    bandLine: rgba(t.text, 0.05),
    city: t.accent,
    local: t.local,
    localBand: rgba(t.local, 0.07),
    sun: t.sun,
    sunGlow: rgba(t.sun, 0.55),
    sunGlowEnd: rgba(t.sun, 0),
    moonLit: '#f2f0e6',
    moonDark: rgba(t.night, dark ? 0.85 : 0.55),
    moonRim: dark ? 'rgba(242, 240, 230, 0.45)' : rgba(t.night, 0.45),
    moonGlow: dark ? 'rgba(242, 240, 230, 0.08)' : rgba(t.night, 0.08),
    night: hexToRgb(t.night),
    nightAlpha: t.nightAlpha,
    leader: rgba(t.text, 0.45),
    labelBg: rgba(t.label, dark ? 0.72 : 0.85),
    labelName: mixHex(t.muted, t.text, 0.3),
    labelTime: t.text,
    flagRim: rgba(t.text, 0.25),
    dotStroke: dark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.85)',
    weather: {
      sun: t.sun,
      moon: mixHex(t.muted, t.text, 0.6),
      cloud: mixHex(t.muted, t.text, dark ? 0.35 : 0.1),
      rain: t.accent,
      bolt: t.local,
    },
    labelTemp: mixHex(t.muted, t.text, 0.55),
    issBody: t.text,
    issPanel: t.accent,
    issTrack: rgba(t.text, dark ? 0.45 : 0.55),
    issTrackPast: rgba(t.text, dark ? 0.18 : 0.25),
    // Erdbeben in festem Rot, damit sie sich von Städten und eigener Zeitzone abheben.
    quake: dark ? '#ff5d4f' : '#d7362a',
    grid: rgba(t.text, dark ? 0.07 : 0.1),
    gridLine: rgba(t.text, dark ? 0.3 : 0.4),
    gridLabel: rgba(t.text, dark ? 0.5 : 0.6),
    dateLine: rgba(t.accent, 0.75),
  };
}

// ---------- Wetter ----------

async function refreshWeather() {
  if (!SHOW_WEATHER || !CITIES.length) return;
  weatherLoadedAt = Date.now();
  weather = await fetchWeather(CITIES);
  render(new Date());
}

// ---------- ISS ----------

let issElements = null;   // Bahnelemente (iss.js), null solange keine geladen sind
let issLoadedAt = 0;

async function refreshIss() {
  if (!SHOW_ISS) return;
  issLoadedAt = Date.now();
  issElements = await fetchIssTle();
  // Ohne Bahnelemente (z. B. offline) nach 15 Minuten erneut versuchen statt erst nach 6 Stunden.
  if (!issElements) issLoadedAt = Date.now() - ISS_TLE_TTL + 15 * 60 * 1000;
  render(new Date());
}

// Bahnspur als Linie; an der Kartenkante (Sprung um mehr als die halbe Breite) wird sie unterbrochen.
function strokeTrack(pts) {
  ctx.beginPath();
  let prevX = null;
  for (const [lon, lat] of pts) {
    const x = projX(lon), y = projY(lat);
    if (prevX === null || Math.abs(x - prevX) > cssW / 2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    prevX = x;
  }
  ctx.stroke();
}

// Raumstation: Rumpf mit zwei Solarflügeln.
function drawIss(x, y, s) {
  ctx.strokeStyle = COLORS.dotStroke;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke();
  ctx.strokeStyle = COLORS.issBody;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke();

  const pw = s * 0.6, ph = s * 0.8;
  ctx.fillStyle = COLORS.issPanel;
  ctx.strokeStyle = COLORS.dotStroke;
  ctx.lineWidth = 1;
  for (const px of [x - s, x + s - pw]) {
    ctx.fillRect(px, y - ph, pw, ph * 2);
    ctx.strokeRect(px, y - ph, pw, ph * 2);
  }
  const b = s * 0.4;
  ctx.fillStyle = COLORS.issBody;
  ctx.fillRect(x - b / 2 - 0.5, y - b / 2 - 0.5, b + 1, b + 1);
  ctx.strokeRect(x - b / 2 - 0.5, y - b / 2 - 0.5, b + 1, b + 1);
}

function renderIss(now) {
  if (!SHOW_ISS || !issElements) return;
  const t = now.getTime();
  const pos = issPosition(issElements, t);
  const period = 86400000 / issElements.n;   // Dauer eines Umlaufs (~92 min)

  // Bahnspur: halber Umlauf zurück (blasser), ein Umlauf voraus (gestrichelt).
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = COLORS.issTrackPast;
  ctx.setLineDash([]);
  strokeTrack(issTrack(issElements, t - period / 2, t));
  ctx.strokeStyle = COLORS.issTrack;
  ctx.setLineDash([4, 4]);
  strokeTrack(issTrack(issElements, t, t + period));
  ctx.setLineDash([]);

  const x = projX(pos.lon), y = projY(pos.lat);
  drawIss(x, y, 9);
  hoverTargets.push({
    x, y, r: 12,
    title: 'ISS',
    lines: [tr('iss.pos', { coords: formatLatLon(pos.lat, pos.lon, 1), alt: Math.round(pos.alt) })],
  });
}

// ---------- Erdbeben ----------

let quakes = [];        // Beben der letzten 24 h (earthquakes.js)
let quakesLoadedAt = 0;
let quakesLoaded = false;
let quakeFeedLoaded = null;

async function refreshQuakes() {
  if (!SHOW_QUAKES) return;
  quakesLoadedAt = Date.now();
  quakeFeedLoaded = quakeFeed(QUAKE_MIN_MAG);
  quakes = await fetchQuakes(QUAKE_MIN_MAG);
  quakesLoaded = true;
  render(new Date());
}

// Radius wächst mit der Stärke: M 2,5 → 3 px, M 4,5 → 6 px, M 7 → 10 px.
const quakeRadius = mag => Math.max(3, 3 + (mag - 2.5) * 1.6);

function formatAgo(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  const span = mins < 60 ? `${mins} min` : m ? `${h} h ${m} min` : `${h} h`;
  return tr('ago', { t: span });
}

// Sichtbare Beben mit Bildschirmposition; wird in render() bestimmt und von drawQuakes()
// in jedem Animationsbild gezeichnet.
let quakeMarks = [];

// Langsames „Atmen“: Zyklusdauer in ms. Jedes Beben bekommt einen eigenen Versatz,
// damit nicht alle im Gleichtakt pulsieren.
const QUAKE_PERIOD = 3800;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const quakePhase = id => {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
};

function renderQuakes(now) {
  quakeMarks = [];
  if (!SHOW_QUAKES) return;
  const t = now.getTime();
  // Schwache Beben zuerst, damit starke obenauf liegen.
  const visible = quakes
    .filter(q => q.mag >= QUAKE_MIN_MAG && t - q.time <= QUAKE_WINDOW && q.lat <= LAT_MAX && q.lat >= LAT_MIN)
    .sort((a, b) => a.mag - b.mag);

  for (const q of visible) {
    const x = projX(q.lon), y = projY(q.lat), r = quakeRadius(q.mag);
    const age = Math.min(1, Math.max(0, (t - q.time) / QUAKE_WINDOW));   // 0 = gerade eben, 1 = vor 24 h
    quakeMarks.push({ x, y, r, age, fresh: t - q.time < 3600000, phase: quakePhase(q.id) });

    const when = new Date(q.time);
    const lines = [];
    if (q.place) lines.push(q.place);
    lines.push(tr('quake.when', { ago: formatAgo(t - q.time), time: timeIn(LOCAL_TZ, when) }));
    lines.push(formatLatLon(q.lat, q.lon, 2)
      + (q.depth != null ? ` · ${tr('quake.depth', { d: Math.round(q.depth) })}` : ''));
    hoverTargets.push({
      x, y, r: Math.max(r + 2, 7),
      title: tr('quake.title', { m: formatNumber(q.mag, 1) }),
      lines,
    });
  }
}

// Zeichnet die Beben zum Zeitpunkt ms (performance.now()). Der Kreis atmet leicht,
// dazu läuft eine blasse Welle nach außen; frische Beben (letzte Stunde) senden zwei Wellen.
function drawQuakes(ms) {
  const still = reducedMotion.matches;
  for (const m of quakeMarks) {
    const k = still ? 0 : mod(ms / QUAKE_PERIOD + m.phase, 1);   // 0…1 im Zyklus
    const breathe = still ? 1 : 1 + 0.08 * Math.sin(k * Math.PI * 2);
    const r = m.r * breathe;

    if (still) {
      if (m.fresh) {
        ctx.strokeStyle = rgba(COLORS.quake, 0.5);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 4, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      const strength = m.fresh ? 0.6 : 0.4 * (1 - m.age * 0.6);
      for (const offset of m.fresh ? [0, 0.5] : [0]) {
        const w = mod(k + offset, 1);
        const ease = 1 - (1 - w) ** 2;   // anfangs schneller, dann auslaufend
        ctx.strokeStyle = rgba(COLORS.quake, strength * (1 - w) ** 1.5);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 1 + ease * (m.r + 8), 0, Math.PI * 2); ctx.stroke();
      }
    }

    ctx.fillStyle = rgba(COLORS.quake, 0.7 - m.age * 0.45);
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.dotStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = rgba(COLORS.quake, 0.95);
    ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(0.5, r - 0.5), 0, Math.PI * 2); ctx.stroke();
  }
}

// ---------- Ebenen und Animation ----------

// render() zeichnet zwei zwischengespeicherte Ebenen: darunter Karte, Nacht und Polarlicht,
// darüber Mond, Sonne, Städte und ISS. compose() setzt sie mit den Beben dazwischen
// zusammen, sodass für die Animation nicht die ganze Karte neu berechnet werden muss.
const underLayer = document.createElement('canvas');
const overLayer = document.createElement('canvas');
const QUAKE_FPS = 24;   // für die langsame Bewegung genügt das
let animId = 0, lastFrame = 0;

function compose(ms) {
  if (!underLayer.width) return;   // noch nicht dimensioniert (vor dem ersten resize)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(underLayer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuakes(ms);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(overLayer, 0, 0);
}

function animateQuakes(ms) {
  animId = 0;
  if (!quakeMarks.length || reducedMotion.matches) return;
  if (ms - lastFrame >= 1000 / QUAKE_FPS - 2) {
    lastFrame = ms;
    compose(ms);
  }
  animId = requestAnimationFrame(animateQuakes);
}

function startQuakeAnimation() {
  if (!animId && quakeMarks.length && !reducedMotion.matches) animId = requestAnimationFrame(animateQuakes);
}
reducedMotion.addEventListener('change', () => { compose(performance.now()); startQuakeAnimation(); });

// ---------- Polarlicht ----------

let aurora = null;        // { grid, forecast } (aurora.js), null solange keine Daten vorliegen
let auroraLoadedAt = 0;
const AURORA_ROWS = LAT_MAX - LAT_MIN + 1;   // Rasterzeilen im sichtbaren Ausschnitt (84° N … 60° S)
const auroraLayer = document.createElement('canvas');
auroraLayer.width = AURORA_W;
auroraLayer.height = AURORA_ROWS;

async function refreshAurora() {
  if (!SHOW_AURORA) return;
  auroraLoadedAt = Date.now();
  aurora = await fetchAurora();
  // Ohne Daten (z. B. offline) nach 2 Minuten erneut versuchen.
  if (!aurora) auroraLoadedAt = Date.now() - AURORA_TTL + 2 * 60 * 1000;
  buildAuroraLayer();
  render(new Date());
}

// Farbe nach Wahrscheinlichkeit: Grün, ab 30 % über Gelb nach Rot (wie bei NOAA).
const AURORA_STOPS = [[0, [60, 255, 122]], [30, [60, 255, 122]], [60, [255, 225, 77]], [90, [255, 77, 77]]];
function auroraColor(p) {
  let i = 1;
  while (i < AURORA_STOPS.length - 1 && p > AURORA_STOPS[i][0]) i++;
  const [p0, c0] = AURORA_STOPS[i - 1], [p1, c1] = AURORA_STOPS[i];
  const f = Math.max(0, Math.min(1, (p - p0) / (p1 - p0)));
  return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
}

// Ein Pixel je Rasterpunkt; Spalte i = Länge −180° + i, Zeile j = Breite 84° − j.
function buildAuroraLayer() {
  const a = auroraLayer.getContext('2d');
  a.clearRect(0, 0, AURORA_W, AURORA_ROWS);
  if (!aurora) return;
  const img = a.createImageData(AURORA_W, AURORA_ROWS);
  for (let j = 0; j < AURORA_ROWS; j++) {
    for (let i = 0; i < AURORA_W; i++) {
      const p = auroraAt(aurora, LAT_MAX - j, i - 180);
      if (p < 3) continue;   // Grundrauschen ausblenden
      const [r, g, b] = auroraColor(p);
      const k = (j * AURORA_W + i) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b;
      img.data[k + 3] = Math.round(Math.min(1, (p - 2) / 40) * 0.8 * 255);
    }
  }
  a.putImageData(img, 0, 0);
}

function renderAurora() {
  if (!SHOW_AURORA || !aurora) return;
  // Pixelmitte = Rasterpunkt, deshalb um einen halben Grad versetzt; am Kartenrand umbrechen.
  const x = projX(-180.5);
  const y = projY(LAT_MAX + 0.5);
  const h = AURORA_ROWS / LAT_RANGE * cssH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(auroraLayer, x, y, cssW, h);
  ctx.drawImage(auroraLayer, x - cssW, y, cssW, h);
}

// Tooltip für die Polarlicht-Ebene an der Mausposition (wenn dort kein anderes Objekt liegt).
function auroraHoverTarget(m) {
  if (!SHOW_AURORA || !aurora) return null;
  const lat = LAT_MAX - m.y / cssH * LAT_RANGE;
  const lon = m.x / cssW * 360 - 180 + centerLon;
  const p = auroraAt(aurora, lat, lon);
  if (p < 3) return null;
  return {
    x: m.x, y: m.y, r: 6,
    title: tr('aurora.title'),
    lines: [tr('aurora.here', { p }), tr('aurora.forecast', { time: timeIn(LOCAL_TZ, new Date(aurora.forecast)) })],
  };
}

// ---------- Gradnetz und Linien ----------

const OBLIQUITY = 23.44;   // Schiefe der Ekliptik; ändert sich nur um etwa 0,013° pro Jahrhundert
const GRID_STEP = 30;
const GRID_LINES = [
  { lat: 90 - OBLIQUITY, key: 'grid.arctic' },
  { lat: OBLIQUITY, key: 'grid.cancer' },
  { lat: 0, key: 'grid.equator' },
  { lat: -OBLIQUITY, key: 'grid.capricorn' },
  // Südlicher Polarkreis (−66,56°) liegt außerhalb des Kartenausschnitts.
];

// Datumsgrenze als [Breite, Länge], vereinfacht: Sie folgt dem 180. Meridian und weicht
// an der Beringstraße, den Aleuten, um Kiribati sowie zwischen Samoa und Amerikanisch-Samoa
// bzw. östlich von Tonga und den Chatham-Inseln ab. Einzelne kleine Inseln liegen nicht exakt.
const DATE_LINE = [
  [90, 180], [75, 180], [68, -169], [65, -169], [53, 170], [48, 180],
  [5, 180], [5, -150], [-12, -150], [-12, -171.2], [-15, -171.2], [-45, -175], [-51, 180], [-90, 180],
];

function renderGrid() {
  if (!SHOW_GRID) return;
  const px = v => Math.round(v) + 0.5;   // scharfe 1-px-Linien
  ctx.save();
  ctx.lineWidth = 1;

  // Gradnetz
  ctx.strokeStyle = COLORS.grid;
  ctx.beginPath();
  for (let lon = -180; lon < 180; lon += GRID_STEP) {
    const x = px(projX(lon));
    ctx.moveTo(x, 0); ctx.lineTo(x, cssH);
  }
  for (let lat = LAT_MIN + GRID_STEP; lat < LAT_MAX; lat += GRID_STEP) {
    if (lat === 0) continue;   // der Äquator wird unten hervorgehoben gezeichnet
    const y = px(projY(lat));
    ctx.moveTo(0, y); ctx.lineTo(cssW, y);
  }
  ctx.stroke();

  // Äquator, Wendekreise, Polarkreis mit Beschriftung am linken Rand
  ctx.font = '10px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  for (const { lat, key } of GRID_LINES) {
    const y = px(projY(lat));
    ctx.strokeStyle = COLORS.gridLine;
    ctx.setLineDash(lat === 0 ? [] : [6, 4]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke();
    ctx.fillStyle = COLORS.gridLabel;
    ctx.fillText(tr(key), 6, y - 2);
  }

  // Datumsgrenze: Längen um 180° stetig machen und an beiden Kartenrändern umgebrochen zeichnen.
  const x180 = projX(180);
  const pts = DATE_LINE.map(([lat, lon]) => [x180 + ((lon < 0 ? lon + 360 : lon) - 180) / 360 * cssW, projY(lat)]);
  ctx.strokeStyle = COLORS.dateLine;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  for (const off of [-cssW, 0, cssW]) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + off, y) : ctx.moveTo(x + off, y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.dateLine;
  ctx.textBaseline = 'top';
  const label = tr('grid.dateline');
  const right = x180 + 4 + ctx.measureText(label).width > cssW;
  ctx.textAlign = right ? 'right' : 'left';
  ctx.fillText(label, right ? x180 - 4 : x180 + 4, 4);
  ctx.restore();
}

// ---------- Flaggen ----------

const flagImages = new Map();   // Ländercode -> HTMLImageElement
let flagRenderPending = false;

// Liefert die Flagge, sobald sie geladen ist; lädt sie sonst nach und zeichnet dann neu.
function flagImage(code) {
  if (!hasFlag(code)) return null;
  const key = code.toLowerCase();
  let img = flagImages.get(key);
  if (!img) {
    img = new Image();
    img.onload = () => {
      if (flagRenderPending) return;
      flagRenderPending = true;
      requestAnimationFrame(() => { flagRenderPending = false; render(new Date()); });
    };
    img.src = flagUrl(key);
    flagImages.set(key, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const formatDeg = (v, digits) => formatNumber(Math.abs(v), digits) + '°';
const formatLatLon = (lat, lon, digits) =>
  `${formatDeg(lat, digits)} ${tr(lat >= 0 ? 'dir.n' : 'dir.s')}, ${formatDeg(lon, digits)} ${tr(lon >= 0 ? 'dir.e' : 'dir.w')}`;

// Tooltip-Zeilen einer Stadt: Koordinaten sowie Sonnenauf- und -untergang in Ortszeit.
function cityTooltipLines(c, now) {
  const lines = [formatLatLon(c.lat, c.lon, 2)];
  const sun = sunTimes(c.lat, c.lon, c.tz, now);
  if (sun.polar === 'day') {
    lines.push(tr('sun.polarDay'));
  } else if (sun.polar === 'night') {
    lines.push(tr('sun.polarNight'));
  } else {
    const mins = Math.round(sun.dayMs / 60000);
    lines.push(tr('sun.times', { rise: timeIn(c.tz, sun.rise), set: timeIn(c.tz, sun.set) }));
    lines.push(tr('sun.dayLength', { h: Math.floor(mins / 60), m: mins % 60 }));
  }
  const p = SHOW_AURORA ? auroraAt(aurora, c.lat, c.lon) : 0;
  if (p > 0) lines.push(tr('aurora.city', { p }));
  return lines;
}

function setTheme(state) {
  const theme = resolveTheme(state);
  COLORS = canvasColors(theme);
  applyThemeCss(theme);
  if (cssW) { buildBaseLayer(); render(new Date()); }
}

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const canvas = document.getElementById('map');
const mainCtx = canvas.getContext('2d');
// Zeichenziel aller Zeichenfunktionen; render() lenkt es vorübergehend auf die Ebenen um.
let ctx = mainCtx;
const mapWrap = document.getElementById('mapWrap');
const bandsEl = document.getElementById('bands');

let rings = [];          // Länderumrisse als Arrays von [lon, lat]
let cssW = 0, cssH = 0, dpr = 1;
let baseLayer = null;    // gecachte Karte ohne zeitabhängige Elemente
let lastSlot = -1;          // letzter Zeichen-Zeitschlitz (tick)

// ---------- Zeitformatierung ----------

const fmtCache = new Map();
function formatter(key, opts) {
  key = LOCALE + key;
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat(LOCALE, opts));
  return fmtCache.get(key);
}
const timeIn = (tz, d) => formatClock(
  formatter('t' + tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d), CLOCK);
const weekdayIn = (tz, d) =>
  formatter('w' + tz, { weekday: 'short', timeZone: tz }).format(d).replace('.', '');
const dayKeyIn = (tz, d) =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(d);

function offsetLabel(hours) {
  if (hours === 0) return 'UTC';
  const sign = hours > 0 ? '+' : '−';
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

function currentOffsetHours(tz, d) {
  // Differenz zwischen Wanduhrzeit in tz und UTC.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asUtc = Date.UTC(+parts.year, parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000) / 60;
}

// ---------- TopoJSON laden ----------

async function loadMap() {
  const res = await fetch('data/countries-110m.json');
  const topo = await res.json();
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;

  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });

  const ring = indices => {
    const pts = [];
    for (const i of indices) {
      const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
      a.forEach((p, k) => { if (k > 0 || pts.length === 0) pts.push(p); });
    }
    return pts;
  };

  // Ringe, die die Datumsgrenze überqueren (Russland, Fidschi), werden
  // "abgewickelt" und zusätzlich um ±360° verschoben gezeichnet.
  const out = [];
  const add = pts => {
    let prev = pts[0][0], shift = 0, min = Infinity, max = -Infinity;
    const unwrapped = pts.map(([lon, lat]) => {
      if (lon - prev > 180) shift -= 360;
      else if (lon - prev < -180) shift += 360;
      prev = lon;
      const l = lon + shift;
      min = Math.min(min, l); max = Math.max(max, l);
      return [l, lat];
    });
    out.push(unwrapped);
    if (max > 180) out.push(unwrapped.map(([l, lat]) => [l - 360, lat]));
    if (min < -180) out.push(unwrapped.map(([l, lat]) => [l + 360, lat]));
  };

  for (const g of topo.objects.countries.geometries) {
    if (g.id === '010') continue; // Antarktis liegt außerhalb des Ausschnitts
    if (g.type === 'Polygon') g.arcs.forEach(r => add(ring(r)));
    else if (g.type === 'MultiPolygon') g.arcs.forEach(poly => poly.forEach(r => add(ring(r))));
  }
  return out;
}

// ---------- Projektion ----------

// Längengrad in der Kartenmitte: 0° (Greenwich) oder, mit „Mittag in der Mitte“,
// der Längengrad des Sonnenhöchststands. Wird in render() gesetzt.
let centerLon = 0;

const mod = (a, n) => ((a % n) + n) % n;
// Feste Projektion (Mitte 0°) für die gecachte Grundkarte; Längen über ±180° erlaubt.
const baseX = lon => (lon + 180) / 360 * cssW;
// Projektion für alles Zeitabhängige: berücksichtigt die Verschiebung und bricht um.
const projX = lon => mod(lon - centerLon + 180, 360) / 360 * cssW;
// Bildschirmabschnitte [x0, x1] eines Längenbereichs; am Kartenrand zweigeteilt.
function lonSpans(lon0, lon1) {
  const x0 = projX(lon0);
  const x1 = x0 + (lon1 - lon0) / 360 * cssW;
  if (x1 <= cssW + 0.01) return [[x0, Math.min(x1, cssW)]];
  return [[x0, cssW], [0, x1 - cssW]];
}
const projY = lat => (LAT_MAX - lat) / LAT_RANGE * cssH;

// ---------- Layout ----------

function resize() {
  const availW = mapWrap.clientWidth - 48;
  const availH = mapWrap.clientHeight - 32 - 50; // Padding + Zeitzonenleiste
  const ratio = 360 / LAT_RANGE;
  cssW = Math.max(300, Math.floor(Math.min(availW, availH * ratio)));
  cssH = Math.floor(cssW / ratio);
  dpr = window.devicePixelRatio || 1;

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  for (const layer of [underLayer, overLayer]) {
    layer.width = canvas.width;
    layer.height = canvas.height;
  }
  bandsEl.style.width = cssW + 'px';

  buildBaseLayer();
  render(new Date());
}

function buildBaseLayer() {
  baseLayer = document.createElement('canvas');
  baseLayer.width = canvas.width;
  baseLayer.height = canvas.height;
  const b = baseLayer.getContext('2d');
  b.scale(dpr, dpr);

  const grad = b.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, COLORS.oceanTop);
  grad.addColorStop(1, COLORS.oceanBottom);
  b.fillStyle = grad;
  b.fillRect(0, 0, cssW, cssH);

  // Länder
  b.beginPath();
  for (const r of rings) {
    r.forEach(([lon, lat], i) => {
      const x = baseX(lon), y = projY(lat);
      if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
    });
    b.closePath();
  }
  b.fillStyle = COLORS.land;
  b.fill('evenodd');
  b.strokeStyle = COLORS.border;
  b.lineWidth = 0.6;
  b.stroke();

  // Nominelle Zeitzonen-Streifen (15° breit, zentriert auf Vielfachen von 15°)
  for (let o = -12; o <= 12; o++) {
    const x0 = baseX(Math.max(-180, o * 15 - 7.5));
    const x1 = baseX(Math.min(180, o * 15 + 7.5));
    if (o % 2 === 0) {
      b.fillStyle = COLORS.band;
      b.fillRect(x0, 0, x1 - x0, cssH);
    }
    b.strokeStyle = COLORS.bandLine;
    b.lineWidth = 1;
    b.beginPath();
    b.moveTo(Math.round(x0) + 0.5, 0);
    b.lineTo(Math.round(x0) + 0.5, cssH);
    b.stroke();
  }
}

// ---------- Sonnenstand / Tag-Nacht ----------

function sunPosition(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = (d.getTime() - start) / 86400000;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10));
  const B = 2 * Math.PI * (doy - 81) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // Minuten
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  let lon = -15 * (utcHours - 12 + eot / 60);
  lon = ((lon + 540) % 360) - 180;
  return { lat: decl, lon };
}

// Sonnenauf- und -untergang am heutigen Kalendertag der Zeitzone tz (Sonnenaufgangsgleichung,
// genau auf etwa eine Minute). Liefert { rise, set, dayMs } oder { polar: 'day' | 'night' }.
function sunTimes(lat, lon, tz, d) {
  const rad = Math.PI / 180;
  const [y, m, day] = dayKeyIn(tz, d).split('-').map(Number);
  const n = Date.UTC(y, m - 1, day) / 86400000 - 10957;     // Tage seit J2000.0 (12 Uhr UTC)
  const jStar = n - lon / 360;                               // ungefährer Sonnenhöchststand
  const M = mod(357.5291 + 0.98560028 * jStar, 360) * rad;   // mittlere Anomalie
  const C = 1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M);
  const lambda = mod(M / rad + C + 180 + 102.9372, 360) * rad; // ekliptikale Länge
  const transit = jStar + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lambda);
  const sinD = Math.sin(lambda) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  // −0,833°: Refraktion und Sonnenradius, d. h. der obere Rand berührt den Horizont.
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  if (cosW < -1) return { polar: 'day' };
  if (cosW > 1) return { polar: 'night' };
  const w = Math.acos(cosW) / rad / 360;                     // halber Tagbogen in Tagen
  const toDate = j => new Date((j + 10957.5) * 86400000);
  return { rise: toDate(transit - w), set: toDate(transit + w), dayMs: 2 * w * 86400000 };
}

// ---------- Mondstand / Mondphase ----------

// Vereinfachte Mondbahn (Hauptterme nach Meeus), genau auf etwa 1°.
// Liefert den Bildpunkt (Mond im Zenit) sowie Beleuchtung und Phase.
function moonPosition(d) {
  const rad = Math.PI / 180;
  const days = d.getTime() / 86400000 - 10957.5;        // Tage seit J2000.0
  const L = (218.316 + 13.176396 * days) * rad;         // mittlere Länge
  const M = (134.963 + 13.064993 * days) * rad;         // mittlere Anomalie
  const F = (93.272 + 13.229350 * days) * rad;          // Argument der Breite
  const l = L + 6.289 * rad * Math.sin(M);              // ekliptikale Länge
  const b = 5.128 * rad * Math.sin(F);                  // ekliptikale Breite
  const e = 23.4397 * rad;                              // Schiefe der Ekliptik

  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const gmst = (280.16 + 360.9856235 * days) * rad;     // Sternzeit Greenwich
  let lon = (ra - gmst) / rad;
  lon = ((lon % 360) + 540) % 360 - 180;

  // Elongation Mond–Sonne bestimmt die Phase.
  const Ms = (357.5291 + 0.98560028 * days) * rad;
  const sunLon = Ms + (1.9148 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms)) * rad + 282.9372 * rad;
  const elong = ((l - sunLon) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

  return {
    lat: dec / rad,
    lon,
    illum: (1 - Math.cos(elong)) / 2,   // beleuchteter Anteil 0…1
    waxing: elong < Math.PI,
    elong: elong / rad,                 // 0° = Neumond, 180° = Vollmond
  };
}

// Acht Phasen ab Neumond (i18n.js).
const moonPhaseName = moon => tr('moon.phases')[Math.round(moon.elong / 45) % 8];

// Mondscheibe mit Phase, wie von der Nordhalbkugel gesehen (zunehmend = rechts hell).
function drawMoon(x, y, r, moon) {
  ctx.fillStyle = COLORS.moonGlow;
  ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = COLORS.moonDark;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  // Heller Rand von oben nach unten, dann Terminator (Halbellipse) zurück nach oben.
  const k = moon.illum;
  const s = moon.waxing ? 1 : -1;                  // Seite des hellen Randes
  const t = k < 0.5 ? s : -s;                      // Seite, zu der sich der Terminator wölbt
  const rx = r * Math.abs(1 - 2 * k);
  ctx.fillStyle = COLORS.moonLit;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, s < 0);
  if (t > 0) ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
  else ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
  ctx.fill();

  ctx.strokeStyle = COLORS.moonRim;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

const NIGHT_W = 720;
const NIGHT_H = Math.round(NIGHT_W * LAT_RANGE / 360);
const nightLayer = document.createElement('canvas');
nightLayer.width = NIGHT_W;
nightLayer.height = NIGHT_H;

function buildNightLayer(sun) {
  const n = nightLayer.getContext('2d');
  const img = n.createImageData(NIGHT_W, NIGHT_H);
  const rad = Math.PI / 180;
  const sinD = Math.sin(sun.lat * rad), cosD = Math.cos(sun.lat * rad);
  const TWILIGHT = -12;    // Grad unter dem Horizont = volle Nacht
  const MAX_ALPHA = COLORS.nightAlpha;
  const [nr, ng, nb] = COLORS.night;

  for (let y = 0; y < NIGHT_H; y++) {
    const lat = (LAT_MAX - (y + 0.5) / NIGHT_H * LAT_RANGE) * rad;
    const sinL = Math.sin(lat), cosL = Math.cos(lat);
    for (let x = 0; x < NIGHT_W; x++) {
      const lon = ((x + 0.5) / NIGHT_W * 360 - 180 + centerLon) * rad;
      const alt = Math.asin(sinL * sinD + cosL * cosD * Math.cos(lon - sun.lon * rad)) / rad;
      let a = 0;
      if (alt < 0) a = alt <= TWILIGHT ? MAX_ALPHA : (alt / TWILIGHT) * MAX_ALPHA;
      const i = (y * NIGHT_W + x) * 4;
      img.data[i] = nr; img.data[i + 1] = ng; img.data[i + 2] = nb;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  n.putImageData(img, 0, 0);
}

// ---------- Rendering ----------

function render(now) {
  if (!baseLayer) return;
  try {
    renderLayers(now);
  } finally {
    ctx = mainCtx;
  }
  compose(performance.now());
  startQuakeAnimation();
  updateTooltip();
  updateLegend();
}

function renderLayers(now) {
  const sun = sunPosition(now);
  centerLon = CENTER_NOON ? sun.lon : 0;
  buildNightLayer(sun);

  // ----- untere Ebene: Karte, Nacht, Polarlicht -----
  ctx = underLayer.getContext('2d');

  // Grundkarte um die Kartenmitte verschoben, rechts umgebrochen (ganze Gerätepixel, damit keine Naht entsteht).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const shift = Math.round(mod(-centerLon / 360, 1) * baseLayer.width);
  ctx.drawImage(baseLayer, shift, 0);
  if (shift) ctx.drawImage(baseLayer, shift - baseLayer.width, 0);
  ctx.scale(dpr, dpr);

  // Lokale Zeitzone hervorheben
  const localOff = -now.getTimezoneOffset() / 60;
  ctx.fillStyle = COLORS.localBand;
  for (const [x0, x1] of lonSpans(Math.max(-180, localOff * 15 - 7.5), Math.min(180, localOff * 15 + 7.5))) {
    ctx.fillRect(x0, 0, x1 - x0, cssH);
  }

  // Nacht
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(nightLayer, 0, 0, cssW, cssH);

  renderAurora();
  renderGrid();

  hoverTargets = [];

  // Beben: nur Positionen und Tooltips, gezeichnet werden sie in compose().
  renderQuakes(now);

  // ----- obere Ebene: Mond, Sonne, Städte, ISS -----
  ctx = overLayer.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overLayer.width, overLayer.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Mond
  if (SHOW_MOON) {
    const moon = moonPosition(now);
    if (moon.lat <= LAT_MAX && moon.lat >= LAT_MIN) {
      const mx = projX(moon.lon), my = projY(moon.lat);
      drawMoon(mx, my, 7, moon);
      hoverTargets.push({
        x: mx, y: my, r: 11,
        title: tr('moon.title'),
        lines: [tr('moon.lit', { phase: moonPhaseName(moon), p: Math.round(moon.illum * 100) })],
      });
    }
  }

  // Sonne
  if (SHOW_SUN && sun.lat <= LAT_MAX && sun.lat >= LAT_MIN) {
    const sx = projX(sun.lon), sy = projY(sun.lat);
    hoverTargets.push({ x: sx, y: sy, r: 11, title: tr('sun.title'), lines: [tr('sun.zenith')] });
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    g.addColorStop(0, COLORS.sunGlow);
    g.addColorStop(1, COLORS.sunGlowEnd);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  }

  drawCities(now, localOff);
  renderIss(now);
  renderBands(now, localOff);
}

// ---------- Tooltip für Sonne, Mond, ISS und Städte ----------

// { x, y, r, title, lines, rects? } in CSS-Pixeln der Karte. Getroffen wird der Kreis um (x, y)
// oder eines der Rechtecke (z. B. das Label einer Stadt).
let hoverTargets = [];
let mouse = null;        // letzte Mausposition über der Karte
const tooltipEl = document.getElementById('mapTooltip');

function updateTooltip() {
  // Zuletzt gezeichnetes Objekt gewinnt bei Überlappung (ISS über Städten über Sonne über Mond).
  const hit = mouse && (hoverTargets.findLast(t =>
    Math.hypot(mouse.x - t.x, mouse.y - t.y) <= t.r ||
    (t.rects || []).some(r => mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h))
    || auroraHoverTarget(mouse));
  if (!hit) { tooltipEl.hidden = true; return; }
  tooltipEl.replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: hit.title }),
    ...hit.lines.map(text => Object.assign(document.createElement('span'), { textContent: text })),
  );
  tooltipEl.hidden = false;
  // Über dem Objekt (samt Label) anzeigen, am Kartenrand nach innen bzw. unten ausweichen.
  let y0 = hit.y - hit.r, y1 = hit.y + hit.r;
  for (const r of hit.rects || []) { y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y + r.h); }
  const w = tooltipEl.offsetWidth, h = tooltipEl.offsetHeight;
  const left = Math.max(4, Math.min(cssW - w - 4, hit.x - w / 2));
  const top = y0 - h - 6 >= 4 ? y0 - h - 6 : y1 + 6;
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  updateTooltip();
});
canvas.addEventListener('mouseleave', () => { mouse = null; updateTooltip(); });

function updateLegend() {
  document.getElementById('legendSun').hidden = !SHOW_SUN;
  document.getElementById('legendMoon').hidden = !SHOW_MOON;
  document.getElementById('legendIss').hidden = !(SHOW_ISS && issElements);
  document.getElementById('legendQuake').hidden = !(SHOW_QUAKES && quakesLoaded);
  document.getElementById('legendAurora').hidden = !(SHOW_AURORA && aurora);
}

function drawCities(now, localOff) {
  const scale = Math.min(1, Math.max(0.78, cssW / 1400));
  const nameSize = Math.round(11 * scale);
  const timeSize = Math.round(14 * scale);
  const padX = 6, padY = 4, gap = 2;
  const localDay = dayKeyIn(LOCAL_TZ, now);
  const placed = [];

  const overlapArea = r => placed.reduce((sum, p) => {
    const ox = Math.min(r.x + r.w + 2, p.x + p.w) - Math.max(r.x - 2, p.x);
    const oy = Math.min(r.y + r.h + 2, p.y + p.h) - Math.max(r.y - 2, p.y);
    return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
  }, 0);
  const inside = r => r.x >= 2 && r.y >= 2 && r.x + r.w <= cssW - 2 && r.y + r.h <= cssH - 2;

  // Zuerst alle Punkte als Hindernisse registrieren
  const items = CITIES.map(c => {
    const x = projX(c.lon), y = projY(c.lat);
    placed.push({ x: x - 5, y: y - 5, w: 10, h: 10 });
    const isLocal = c.tz === LOCAL_TZ || currentOffsetHours(c.tz, now) === localOff;
    const day = dayKeyIn(c.tz, now);
    const name = day !== localDay ? `${c.name} · ${weekdayIn(c.tz, now)}` : c.name;
    const wx = SHOW_WEATHER ? weather.get(weatherKey(c)) : null;
    const flag = SHOW_FLAGS ? flagImage(c.country) : null;
    return { c, x, y, isLocal, name, time: timeIn(c.tz, now), wx, flag };
  });

  // Flagge im Seitenverhältnis 4:3, so hoch wie die Großbuchstaben des Namens.
  const flagH = Math.round(nameSize * 0.85);
  const flagW = Math.round(flagH * 4 / 3);
  const flagGap = 4;

  const iconSize = Math.round(timeSize * 1.15);
  const tempSize = Math.round(12 * scale);
  const tempFont = `${tempSize}px "Segoe UI", system-ui, sans-serif`;

  for (const it of items) {
    ctx.font = `${nameSize}px "Segoe UI", system-ui, sans-serif`;
    const wName = ctx.measureText(it.name).width + (it.flag ? flagW + flagGap : 0);
    ctx.font = `600 ${timeSize}px "Segoe UI", system-ui, sans-serif`;
    const wTime = ctx.measureText(it.time).width;
    let wWeather = 0;
    if (it.wx) {
      it.temp = formatTemp(it.wx.temp, TEMP_UNIT);
      ctx.font = tempFont;
      wWeather = 8 + iconSize + 3 + ctx.measureText(it.temp).width;
    }
    const w = Math.max(wName, wTime + wWeather) + padX * 2;
    const h = nameSize + timeSize + gap + padY * 2;

    const { x, y } = it;
    const candidates = [
      { x: x + 9,      y: y - h / 2 },  // rechts
      { x: x - 9 - w,  y: y - h / 2 },  // links
      { x: x + 6,      y: y - 6 - h },  // oben rechts
      { x: x + 6,      y: y + 6 },      // unten rechts
      { x: x - 6 - w,  y: y - 6 - h },  // oben links
      { x: x - 6 - w,  y: y + 6 },      // unten links
      { x: x - w / 2,  y: y - 10 - h }, // oben
      { x: x - w / 2,  y: y + 10 },     // unten
      // weiter entfernt, mit Hilfslinie
      { x: x - w - 14, y: y + 14,         leader: true },
      { x: x + 14,     y: y + 14,         leader: true },
      { x: x - w - 14, y: y - 14 - h,     leader: true },
      { x: x + 14,     y: y - 14 - h,     leader: true },
      { x: x - w / 2,  y: y + 22,         leader: true },
      { x: x - w / 2,  y: y - 22 - h,     leader: true },
    ].map(p => ({ ...p, w, h }));

    // Erste Position ohne Überlappung, sonst die mit der geringsten.
    let box = null, best = Infinity;
    for (const r of candidates) {
      if (!inside(r)) continue;
      const a = overlapArea(r);
      if (a === 0) { box = r; break; }
      if (a < best) { best = a; box = r; }
    }
    box = box || candidates[0];
    placed.push(box);
    hoverTargets.push({
      x, y, r: 8,
      rects: [box],
      title: it.c.name,
      lines: cityTooltipLines(it.c, now),
    });

    const accent = it.isLocal ? COLORS.local : COLORS.city;

    if (box.leader) {
      const cx = Math.max(box.x, Math.min(x, box.x + box.w));
      const cy = Math.max(box.y, Math.min(y, box.y + box.h));
      ctx.strokeStyle = COLORS.leader;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke();
    }

    // Label
    ctx.fillStyle = COLORS.labelBg;
    roundRect(box.x, box.y, box.w, box.h, 5);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(box.x, box.y + 4, 2, box.h - 8);

    ctx.textBaseline = 'top';
    ctx.font = `${nameSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = COLORS.labelName;
    let nameX = box.x + padX;
    if (it.flag) {
      const fy = Math.round(box.y + padY + (nameSize - flagH) / 2 + 1);
      ctx.drawImage(it.flag, nameX, fy, flagW, flagH);
      ctx.strokeStyle = COLORS.flagRim;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(nameX + 0.25, fy + 0.25, flagW - 0.5, flagH - 0.5);
      nameX += flagW + flagGap;
    }
    ctx.fillText(it.name, nameX, box.y + padY);
    ctx.font = `600 ${timeSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = it.isLocal ? COLORS.local : COLORS.labelTime;
    const rowY = box.y + padY + nameSize + gap;
    ctx.fillText(it.time, box.x + padX, rowY);

    if (it.wx) {
      const ix = box.x + padX + wTime + 8;
      const iy = rowY + (timeSize - iconSize) / 2 + 1;
      drawWeatherIcon(ctx, weatherKind(it.wx.code), it.wx.day, ix, iy, iconSize, COLORS.weather);
      ctx.font = tempFont;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.labelTemp;
      ctx.fillText(it.temp, ix + iconSize + 3, rowY + timeSize / 2 + 1);
      ctx.textBaseline = 'top';
    }

    // Punkt
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.dotStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderBands(now, localOff) {
  const roundedLocal = Math.round(localOff);
  const bandW = cssW / 24;
  // Jede Zone als Abschnitt(e) unterhalb der Karte, passend zur aktuellen Verschiebung.
  const segs = [];
  for (let o = -12; o <= 12; o++) {
    for (const [x0, x1] of lonSpans(Math.max(-180, o * 15 - 7.5), Math.min(180, o * 15 + 7.5))) {
      if (x1 - x0 > 0.01) segs.push({ o, x0, x1 });
    }
  }
  segs.sort((a, b) => a.x0 - b.x0);

  const html = segs.map(({ o, x0, x1 }) => {
    const w = x1 - x0;
    const cls = ['band'];
    if (o === roundedLocal) cls.push('local');
    if (w < bandW * 0.75) cls.push('edge');
    if (w < bandW * 0.99 && x0 < 0.5) cls.push('start');
    else if (w < bandW * 0.99 && x1 > cssW - 0.5) cls.push('end');
    let body = '';
    if (w >= bandW * 0.45) {
      const t = new Date(now.getTime() + o * 3600000);
      const { time, period } = splitClock(
        formatter('utc', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(t), CLOCK);
      const label = Math.abs(o) === 12 ? (o > 0 ? '+12' : '−12') : offsetLabel(o).replace('UTC', '') || 'UTC';
      body = `<div class="off">${label}</div><div class="time">${time}${period ? `<span class="ampm">${period}</span>` : ''}</div>`;
    }
    return `<div class="${cls.join(' ')}" style="flex-grow:${w.toFixed(3)}" title="${offsetLabel(o)}">${body}</div>`;
  });
  bandsEl.innerHTML = html.join('');
}

// ---------- Kopfzeile ----------

const elTime = document.getElementById('localTime');
const elDate = document.getElementById('localDate');
const elZone = document.getElementById('localZone');

function updateHeader(now) {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const { time, period } = splitClock(`${hh}:${mm}`, CLOCK);
  elTime.innerHTML = `${time}<span class="sec">:${ss}</span>${period ? `<span class="ampm">${period}</span>` : ''}`;
  elDate.textContent = now.toLocaleDateString(LOCALE, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  elZone.textContent = `${LOCAL_TZ.replace(/_/g, ' ')} · ${offsetLabel(-now.getTimezoneOffset() / 60)}`;
}

// ---------- Start ----------

function tick() {
  const now = new Date();
  updateHeader(now);
  // Die ISS legt pro Minute rund 4 Längengrade zurück, deshalb mit ihr alle 10 Sekunden neu zeichnen.
  const step = SHOW_ISS ? 10000 : 60000;
  const slot = Math.floor(now.getTime() / step);
  if (slot !== lastSlot) {
    lastSlot = slot;
    render(now);
    if (SHOW_WEATHER && now.getTime() - weatherLoadedAt > WEATHER_TTL) refreshWeather();
    if (SHOW_ISS && now.getTime() - issLoadedAt > ISS_TLE_TTL) refreshIss();
    if (SHOW_QUAKES && now.getTime() - quakesLoadedAt > QUAKE_TTL) refreshQuakes();
    if (SHOW_AURORA && now.getTime() - auroraLoadedAt > AURORA_TTL) refreshAurora();
  }
}

(async function init() {
  applyI18n();
  updateHeader(new Date());
  const [map, settings, themeState] = await Promise.all([loadMap(), loadSettings(), loadThemeState()]);
  rings = map;
  if (settings.lang !== LANG) { setLanguage(settings.lang); applyI18n(); updateHeader(new Date()); }
  CITIES = resolveCities(settings);
  SHOW_WEATHER = settings.showWeather;
  SHOW_SUN = settings.showSun;
  SHOW_MOON = settings.showMoon;
  SHOW_FLAGS = settings.showFlags;
  CENTER_NOON = settings.centerNoon;
  SHOW_ISS = settings.showIss;
  TEMP_UNIT = settings.tempUnit;
  CLOCK = settings.clock;
  SHOW_QUAKES = settings.showQuakes;
  QUAKE_MIN_MAG = settings.quakeMinMag;
  SHOW_AURORA = settings.showAurora;
  SHOW_GRID = settings.showGrid;
  setTheme(themeState);
  resize();
  refreshWeather();
  refreshIss();
  refreshQuakes();
  refreshAurora();

  onThemeChanged(setTheme);

  onSettingsChanged(s => {
    if (s.lang !== LANG) { setLanguage(s.lang); applyI18n(); }
    CITIES = resolveCities(s);
    SHOW_WEATHER = s.showWeather;
    SHOW_SUN = s.showSun;
    SHOW_MOON = s.showMoon;
    SHOW_FLAGS = s.showFlags;
    CENTER_NOON = s.centerNoon;
    SHOW_ISS = s.showIss;
    TEMP_UNIT = s.tempUnit;
    CLOCK = s.clock;
    SHOW_QUAKES = s.showQuakes;
    QUAKE_MIN_MAG = s.quakeMinMag;
    SHOW_AURORA = s.showAurora;
    SHOW_GRID = s.showGrid;
    updateHeader(new Date());
    render(new Date());
    refreshWeather();   // holt nur fehlende/veraltete Städte nach (Cache)
    if (SHOW_ISS && !issElements) refreshIss();
    // Neu laden beim Einschalten oder wenn die Mindeststärke einen anderen Feed braucht.
    if (SHOW_QUAKES && (!quakesLoaded || quakeFeedLoaded !== quakeFeed(QUAKE_MIN_MAG))) refreshQuakes();
    if (SHOW_AURORA && !aurora) refreshAurora();
  });

  // openOptionsPage schlägt fehl, wenn Chrome noch ein Manifest ohne options_ui
  // geladen hat (Erweiterung nach Update nicht neu geladen). Dann direkt öffnen.
  document.getElementById('settingsBtn').addEventListener('click', async () => {
    try {
      await chrome.runtime.openOptionsPage();
    } catch {
      location.href = 'options.html';
    }
  });
  lastSlot = Math.floor(Date.now() / (SHOW_ISS ? 10000 : 60000));
  setInterval(tick, 1000);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { lastSlot = -1; tick(); }
  });
})();
