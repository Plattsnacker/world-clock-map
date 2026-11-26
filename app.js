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
  };
}

// ---------- Wetter ----------

async function refreshWeather() {
  if (!SHOW_WEATHER || !CITIES.length) return;
  weatherLoadedAt = Date.now();
  weather = await fetchWeather(CITIES);
  render(new Date());
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

const formatTemp = t => {
  const r = Math.round(t);
  return `${r < 0 ? '−' : ''}${Math.abs(r)} °C`;
};

function setTheme(state) {
  const theme = resolveTheme(state);
  COLORS = canvasColors(theme);
  applyThemeCss(theme);
  if (cssW) { buildBaseLayer(); render(new Date()); }
}

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const mapWrap = document.getElementById('mapWrap');
const bandsEl = document.getElementById('bands');

let rings = [];          // Länderumrisse als Arrays von [lon, lat]
let cssW = 0, cssH = 0, dpr = 1;
let baseLayer = null;    // gecachte Karte ohne zeitabhängige Elemente
let lastMinute = -1;

// ---------- Zeitformatierung ----------

const fmtCache = new Map();
function formatter(key, opts) {
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat('de-DE', opts));
  return fmtCache.get(key);
}
const timeIn = (tz, d) =>
  formatter('t' + tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d);
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

const MOON_PHASES = [
  'Neumond', 'Zunehmende Sichel', 'Erstes Viertel', 'Zunehmender Mond',
  'Vollmond', 'Abnehmender Mond', 'Letztes Viertel', 'Abnehmende Sichel',
];
const moonPhaseName = moon => MOON_PHASES[Math.round(moon.elong / 45) % 8];

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
  const sun = sunPosition(now);
  centerLon = CENTER_NOON ? sun.lon : 0;
  buildNightLayer(sun);

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

  hoverTargets = [];

  // Mond
  if (SHOW_MOON) {
    const moon = moonPosition(now);
    if (moon.lat <= LAT_MAX && moon.lat >= LAT_MIN) {
      const mx = projX(moon.lon), my = projY(moon.lat);
      drawMoon(mx, my, 7, moon);
      hoverTargets.push({
        x: mx, y: my, r: 11,
        title: 'Mond',
        detail: `${moonPhaseName(moon)} · ${Math.round(moon.illum * 100)} % beleuchtet`,
      });
    }
  }

  // Sonne
  if (SHOW_SUN && sun.lat <= LAT_MAX && sun.lat >= LAT_MIN) {
    const sx = projX(sun.lon), sy = projY(sun.lat);
    hoverTargets.push({ x: sx, y: sy, r: 11, title: 'Sonne', detail: 'steht hier im Zenit' });
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    g.addColorStop(0, COLORS.sunGlow);
    g.addColorStop(1, COLORS.sunGlowEnd);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  }

  drawCities(now, localOff);
  renderBands(now, localOff);
  updateTooltip();
  updateLegend();
}

// ---------- Tooltip für Sonne und Mond ----------

let hoverTargets = [];   // { x, y, r, title, detail } in CSS-Pixeln der Karte
let mouse = null;        // letzte Mausposition über der Karte
const tooltipEl = document.getElementById('mapTooltip');

function updateTooltip() {
  // Zuletzt gezeichnetes Objekt (Sonne über Mond) gewinnt bei Überlappung.
  const hit = mouse && hoverTargets.findLast(t => Math.hypot(mouse.x - t.x, mouse.y - t.y) <= t.r);
  if (!hit) { tooltipEl.hidden = true; return; }
  tooltipEl.replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: hit.title }),
    Object.assign(document.createElement('span'), { textContent: hit.detail }),
  );
  tooltipEl.hidden = false;
  // Über dem Objekt anzeigen, am Kartenrand nach innen bzw. unten ausweichen.
  const w = tooltipEl.offsetWidth, h = tooltipEl.offsetHeight;
  const left = Math.max(4, Math.min(cssW - w - 4, hit.x - w / 2));
  const top = hit.y - hit.r - h - 6 >= 4 ? hit.y - hit.r - h - 6 : hit.y + hit.r + 6;
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
      it.temp = formatTemp(it.wx.temp);
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
      const time = formatter('utc', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(t);
      const label = Math.abs(o) === 12 ? (o > 0 ? '+12' : '−12') : offsetLabel(o).replace('UTC', '') || 'UTC';
      body = `<div class="off">${label}</div><div class="time">${time}</div>`;
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
  elTime.innerHTML = `${hh}:${mm}<span class="sec">:${ss}</span>`;
  elDate.textContent = now.toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  elZone.textContent = `${LOCAL_TZ.replace(/_/g, ' ')} · ${offsetLabel(-now.getTimezoneOffset() / 60)}`;
}

// ---------- Start ----------

function tick() {
  const now = new Date();
  updateHeader(now);
  const minute = Math.floor(now.getTime() / 60000);
  if (minute !== lastMinute) {
    lastMinute = minute;
    render(now);
    if (SHOW_WEATHER && now.getTime() - weatherLoadedAt > WEATHER_TTL) refreshWeather();
  }
}

(async function init() {
  updateHeader(new Date());
  const [map, settings, themeState] = await Promise.all([loadMap(), loadSettings(), loadThemeState()]);
  rings = map;
  CITIES = resolveCities(settings);
  SHOW_WEATHER = settings.showWeather;
  SHOW_SUN = settings.showSun;
  SHOW_MOON = settings.showMoon;
  SHOW_FLAGS = settings.showFlags;
  CENTER_NOON = settings.centerNoon;
  setTheme(themeState);
  resize();
  refreshWeather();

  onThemeChanged(setTheme);

  onSettingsChanged(s => {
    CITIES = resolveCities(s);
    SHOW_WEATHER = s.showWeather;
    SHOW_SUN = s.showSun;
    SHOW_MOON = s.showMoon;
    SHOW_FLAGS = s.showFlags;
    CENTER_NOON = s.centerNoon;
    render(new Date());
    refreshWeather();   // holt nur fehlende/veraltete Städte nach (Cache)
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
  lastMinute = Math.floor(Date.now() / 60000);
  setInterval(tick, 1000);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { lastMinute = -1; tick(); }
  });
})();
