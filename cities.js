'use strict';

// Gemeinsamer Städtekatalog und Speicherzugriff für Neuer-Tab- und Einstellungsseite.

const REGIONS = [
  'Nordamerika',
  'Mittel- & Südamerika',
  'Europa',
  'Afrika',
  'Asien',
  'Ozeanien',
];

// [Name, IANA-Zeitzone, Breite, Länge, Region-Index, Ländercode (ISO 3166-1 alpha-2)]
const CATALOG_RAW = [
  ['Honolulu',        'Pacific/Honolulu',               21.31, -157.86, 0, 'us'],
  ['Anchorage',       'America/Anchorage',              61.22, -149.90, 0, 'us'],
  ['Vancouver',       'America/Vancouver',              49.28, -123.12, 0, 'ca'],
  ['Seattle',         'America/Los_Angeles',            47.61, -122.33, 0, 'us'],
  ['San Francisco',   'America/Los_Angeles',            37.77, -122.42, 0, 'us'],
  ['Los Angeles',     'America/Los_Angeles',            34.05, -118.24, 0, 'us'],
  ['Las Vegas',       'America/Los_Angeles',            36.17, -115.14, 0, 'us'],
  ['Phoenix',         'America/Phoenix',                33.45, -112.07, 0, 'us'],
  ['Calgary',         'America/Edmonton',               51.05, -114.07, 0, 'ca'],
  ['Denver',          'America/Denver',                 39.74, -104.99, 0, 'us'],
  ['Dallas',          'America/Chicago',                32.78,  -96.80, 0, 'us'],
  ['Houston',         'America/Chicago',                29.76,  -95.37, 0, 'us'],
  ['Chicago',         'America/Chicago',                41.88,  -87.63, 0, 'us'],
  ['Atlanta',         'America/New_York',               33.75,  -84.39, 0, 'us'],
  ['Miami',           'America/New_York',               25.76,  -80.19, 0, 'us'],
  ['Toronto',         'America/Toronto',                43.65,  -79.38, 0, 'ca'],
  ['Montreal',        'America/Toronto',                45.50,  -73.57, 0, 'ca'],
  ['New York',        'America/New_York',               40.71,  -74.01, 0, 'us'],
  ['Washington',      'America/New_York',               38.91,  -77.04, 0, 'us'],
  ['Boston',          'America/New_York',               42.36,  -71.06, 0, 'us'],
  ['Halifax',         'America/Halifax',                44.65,  -63.57, 0, 'ca'],
  ["St. John's",      'America/St_Johns',               47.56,  -52.71, 0, 'ca'],
  ['Nuuk',            'America/Nuuk',                   64.18,  -51.72, 0, 'gl'],

  ['Mexiko-Stadt',    'America/Mexico_City',            19.43,  -99.13, 1, 'mx'],
  ['Havanna',         'America/Havana',                 23.11,  -82.37, 1, 'cu'],
  ['Panama-Stadt',    'America/Panama',                  8.98,  -79.52, 1, 'pa'],
  ['Bogotá',          'America/Bogota',                  4.71,  -74.07, 1, 'co'],
  ['Caracas',         'America/Caracas',                10.48,  -66.90, 1, 've'],
  ['Quito',           'America/Guayaquil',              -0.18,  -78.47, 1, 'ec'],
  ['Lima',            'America/Lima',                  -12.05,  -77.04, 1, 'pe'],
  ['La Paz',          'America/La_Paz',                -16.49,  -68.12, 1, 'bo'],
  ['Santiago de Chile','America/Santiago',             -33.45,  -70.67, 1, 'cl'],
  ['Buenos Aires',    'America/Argentina/Buenos_Aires',-34.60,  -58.38, 1, 'ar'],
  ['Montevideo',      'America/Montevideo',            -34.90,  -56.16, 1, 'uy'],
  ['São Paulo',       'America/Sao_Paulo',             -23.55,  -46.63, 1, 'br'],
  ['Rio de Janeiro',  'America/Sao_Paulo',             -22.91,  -43.17, 1, 'br'],

  ['Reykjavík',       'Atlantic/Reykjavik',             64.15,  -21.94, 2, 'is'],
  ['Dublin',          'Europe/Dublin',                  53.35,   -6.26, 2, 'ie'],
  ['Lissabon',        'Europe/Lisbon',                  38.72,   -9.14, 2, 'pt'],
  ['Madrid',          'Europe/Madrid',                  40.42,   -3.70, 2, 'es'],
  ['London',          'Europe/London',                  51.51,   -0.13, 2, 'gb'],
  ['Paris',           'Europe/Paris',                   48.86,    2.35, 2, 'fr'],
  ['Amsterdam',       'Europe/Amsterdam',               52.37,    4.90, 2, 'nl'],
  ['Brüssel',         'Europe/Brussels',                50.85,    4.35, 2, 'be'],
  ['Zürich',          'Europe/Zurich',                  47.38,    8.54, 2, 'ch'],
  ['Rom',             'Europe/Rome',                    41.90,   12.50, 2, 'it'],
  ['Hamburg',         'Europe/Berlin',                  53.55,    9.99, 2, 'de'],
  ['Berlin',          'Europe/Berlin',                  52.52,   13.40, 2, 'de'],
  ['Köln',            'Europe/Berlin',                  50.94,    6.96, 2, 'de'],
  ['Frankfurt',       'Europe/Berlin',                  50.11,    8.68, 2, 'de'],
  ['München',         'Europe/Berlin',                  48.14,   11.58, 2, 'de'],
  ['Wien',            'Europe/Vienna',                  48.21,   16.37, 2, 'at'],
  ['Prag',            'Europe/Prague',                  50.08,   14.44, 2, 'cz'],
  ['Kopenhagen',      'Europe/Copenhagen',              55.68,   12.57, 2, 'dk'],
  ['Oslo',            'Europe/Oslo',                    59.91,   10.75, 2, 'no'],
  ['Stockholm',       'Europe/Stockholm',               59.33,   18.07, 2, 'se'],
  ['Warschau',        'Europe/Warsaw',                  52.23,   21.01, 2, 'pl'],
  ['Budapest',        'Europe/Budapest',                47.50,   19.04, 2, 'hu'],
  ['Helsinki',        'Europe/Helsinki',                60.17,   24.94, 2, 'fi'],
  ['Athen',           'Europe/Athens',                  37.98,   23.73, 2, 'gr'],
  ['Kiew',            'Europe/Kyiv',                    50.45,   30.52, 2, 'ua'],
  ['Istanbul',        'Europe/Istanbul',                41.01,   28.98, 2, 'tr'],
  ['Moskau',          'Europe/Moscow',                  55.76,   37.62, 2, 'ru'],

  ['Casablanca',      'Africa/Casablanca',              33.57,   -7.59, 3, 'ma'],
  ['Dakar',           'Africa/Dakar',                   14.72,  -17.47, 3, 'sn'],
  ['Accra',           'Africa/Accra',                    5.60,   -0.19, 3, 'gh'],
  ['Lagos',           'Africa/Lagos',                    6.52,    3.38, 3, 'ng'],
  ['Kairo',           'Africa/Cairo',                   30.04,   31.24, 3, 'eg'],
  ['Addis Abeba',     'Africa/Addis_Ababa',              9.03,   38.74, 3, 'et'],
  ['Nairobi',         'Africa/Nairobi',                 -1.29,   36.82, 3, 'ke'],
  ['Kinshasa',        'Africa/Kinshasa',                -4.44,   15.27, 3, 'cd'],
  ['Johannesburg',    'Africa/Johannesburg',           -26.20,   28.05, 3, 'za'],
  ['Kapstadt',        'Africa/Johannesburg',           -33.92,   18.42, 3, 'za'],

  ['Tel Aviv',        'Asia/Jerusalem',                 32.09,   34.78, 4, 'il'],
  ['Riad',            'Asia/Riyadh',                    24.71,   46.68, 4, 'sa'],
  ['Teheran',         'Asia/Tehran',                    35.69,   51.39, 4, 'ir'],
  ['Dubai',           'Asia/Dubai',                     25.20,   55.27, 4, 'ae'],
  ['Karatschi',       'Asia/Karachi',                   24.86,   67.01, 4, 'pk'],
  ['Almaty',          'Asia/Almaty',                    43.24,   76.89, 4, 'kz'],
  ['Neu-Delhi',       'Asia/Kolkata',                   28.61,   77.21, 4, 'in'],
  ['Mumbai',          'Asia/Kolkata',                   19.08,   72.88, 4, 'in'],
  ['Kathmandu',       'Asia/Kathmandu',                 27.72,   85.32, 4, 'np'],
  ['Dhaka',           'Asia/Dhaka',                     23.81,   90.41, 4, 'bd'],
  ['Bangkok',         'Asia/Bangkok',                   13.76,  100.50, 4, 'th'],
  ['Singapur',        'Asia/Singapore',                  1.35,  103.82, 4, 'sg'],
  ['Jakarta',         'Asia/Jakarta',                   -6.21,  106.85, 4, 'id'],
  ['Hongkong',        'Asia/Hong_Kong',                 22.32,  114.17, 4, 'hk'],
  ['Manila',          'Asia/Manila',                    14.60,  120.98, 4, 'ph'],
  ['Peking',          'Asia/Shanghai',                  39.90,  116.40, 4, 'cn'],
  ['Shanghai',        'Asia/Shanghai',                  31.23,  121.47, 4, 'cn'],
  ['Seoul',           'Asia/Seoul',                     37.57,  126.98, 4, 'kr'],
  ['Tokio',           'Asia/Tokyo',                     35.68,  139.69, 4, 'jp'],
  ['Wladiwostok',     'Asia/Vladivostok',               43.12,  131.89, 4, 'ru'],

  ['Perth',           'Australia/Perth',               -31.95,  115.86, 5, 'au'],
  ['Darwin',          'Australia/Darwin',              -12.46,  130.84, 5, 'au'],
  ['Adelaide',        'Australia/Adelaide',            -34.93,  138.60, 5, 'au'],
  ['Brisbane',        'Australia/Brisbane',            -27.47,  153.03, 5, 'au'],
  ['Melbourne',       'Australia/Melbourne',           -37.81,  144.96, 5, 'au'],
  ['Sydney',          'Australia/Sydney',              -33.87,  151.21, 5, 'au'],
  ['Auckland',        'Pacific/Auckland',              -36.85,  174.76, 5, 'nz'],
  ['Suva (Fidschi)',  'Pacific/Fiji',                  -18.14,  178.44, 5, 'fj'],
];

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; }
  catch { return false; }
}

const CATALOG = CATALOG_RAW
  .map(([name, tz, lat, lon, r, country]) => ({ id: slugify(name), name, tz, lat, lon, region: REGIONS[r], country }))
  .filter(c => isValidTimeZone(c.tz));


// ---------- Flaggen (flags/, aus dem MIT-lizenzierten Paket flag-icons) ----------

// Ländercodes, für die eine Flagge in flags/<code>.svg liegt.
const FLAG_CODES = new Set((
  'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs ' +
  'bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee ' +
  'eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm ' +
  'hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc ' +
  'li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na ' +
  'nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw ' +
  'sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to ' +
  'tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws xk ye yt za zm zw'
).split(' '));

const hasFlag = code => typeof code === 'string' && FLAG_CODES.has(code.toLowerCase());
const flagUrl = code => `flags/${code.toLowerCase()}.svg`;

let regionNames = null;
function countryName(code) {
  try {
    regionNames = regionNames || new Intl.DisplayNames(['de'], { type: 'region' });
    return regionNames.of(code.toUpperCase()) || code.toUpperCase();
  } catch { return code.toUpperCase(); }
}

const DEFAULT_IDS = [
  'honolulu', 'anchorage', 'vancouver', 'los-angeles', 'denver', 'mexiko-stadt',
  'new-york', 'toronto', 'quito', 'lima', 'sao-paulo', 'nuuk', 'reykjavik',
  'lissabon', 'london', 'berlin', 'hamburg', 'lagos', 'kairo', 'moskau', 'nairobi',
  'johannesburg', 'dubai', 'neu-delhi', 'bangkok', 'singapur', 'peking', 'tokio',
  'perth', 'sydney', 'auckland',
];

const DEFAULT_SETTINGS = {
  selected: DEFAULT_IDS, custom: [], showWeather: false, showSun: true, showMoon: true, showFlags: false,
  centerNoon: false, showIss: false, tempUnit: 'c', clock: '24',
};

// ---------- Einheiten ----------

// Zerlegt eine Uhrzeit "HH:MM" (24 h) je nach Format in Zeit und Tageshälfte,
// z. B. "23:05" → { time: "11:05", period: "PM" } bei 12-Stunden-Anzeige.
function splitClock(hhmm, clock) {
  if (clock !== '12') return { time: hhmm, period: '' };
  const [h, m] = hhmm.split(':');
  return { time: `${+h % 12 || 12}:${m}`, period: +h < 12 ? 'AM' : 'PM' };
}
function formatClock(hhmm, clock) {
  const { time, period } = splitClock(hhmm, clock);
  return period ? `${time} ${period}` : time;
}

// Temperatur in °C, ausgegeben in der gewählten Einheit ('c' oder 'f').
function formatTemp(celsius, unit) {
  const r = Math.round(unit === 'f' ? celsius * 9 / 5 + 32 : celsius);
  return `${r < 0 ? '−' : ''}${Math.abs(r)} ${unit === 'f' ? '°F' : '°C'}`;
}

// ---------- Speicher (chrome.storage.sync, Fallback localStorage für lokale Tests) ----------

const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;
const LS_KEY = 'weltzeit-settings';

async function loadSettings() {
  let s;
  if (hasChromeStorage) {
    s = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  } else {
    try { s = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { s = {}; }
  }
  return {
    selected: Array.isArray(s.selected) ? s.selected : [...DEFAULT_IDS],
    custom: Array.isArray(s.custom) ? s.custom : [],
    showWeather: s.showWeather === true,
    showSun: s.showSun !== false,
    showMoon: s.showMoon !== false,
    showFlags: s.showFlags === true,
    centerNoon: s.centerNoon === true,
    showIss: s.showIss === true,
    tempUnit: s.tempUnit === 'f' ? 'f' : 'c',
    clock: s.clock === '12' ? '12' : '24',
  };
}

async function saveSettings(settings) {
  const data = {
    selected: settings.selected,
    custom: settings.custom,
    showWeather: !!settings.showWeather,
    showSun: settings.showSun !== false,
    showMoon: settings.showMoon !== false,
    showFlags: !!settings.showFlags,
    centerNoon: !!settings.centerNoon,
    showIss: !!settings.showIss,
    tempUnit: settings.tempUnit === 'f' ? 'f' : 'c',
    clock: settings.clock === '12' ? '12' : '24',
  };
  if (hasChromeStorage) await chrome.storage.sync.set(data);
  else localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function onSettingsChanged(callback) {
  if (hasChromeStorage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && Object.keys(DEFAULT_SETTINGS).some(k => k in changes)) loadSettings().then(callback);
    });
  } else {
    window.addEventListener('storage', e => { if (e.key === LS_KEY) loadSettings().then(callback); });
  }
}

// Ausgewählte Städte in Katalogreihenfolge, danach eigene Städte.
function resolveCities(settings) {
  const sel = new Set(settings.selected);
  const custom = settings.custom.filter(c => isValidTimeZone(c.tz));
  return [...CATALOG, ...custom].filter(c => sel.has(c.id));
}
