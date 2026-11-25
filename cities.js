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

// [Name, IANA-Zeitzone, Breite, Länge, Region-Index]
const CATALOG_RAW = [
  ['Honolulu',        'Pacific/Honolulu',               21.31, -157.86, 0],
  ['Anchorage',       'America/Anchorage',              61.22, -149.90, 0],
  ['Vancouver',       'America/Vancouver',              49.28, -123.12, 0],
  ['Seattle',         'America/Los_Angeles',            47.61, -122.33, 0],
  ['San Francisco',   'America/Los_Angeles',            37.77, -122.42, 0],
  ['Los Angeles',     'America/Los_Angeles',            34.05, -118.24, 0],
  ['Las Vegas',       'America/Los_Angeles',            36.17, -115.14, 0],
  ['Phoenix',         'America/Phoenix',                33.45, -112.07, 0],
  ['Calgary',         'America/Edmonton',               51.05, -114.07, 0],
  ['Denver',          'America/Denver',                 39.74, -104.99, 0],
  ['Dallas',          'America/Chicago',                32.78,  -96.80, 0],
  ['Houston',         'America/Chicago',                29.76,  -95.37, 0],
  ['Chicago',         'America/Chicago',                41.88,  -87.63, 0],
  ['Atlanta',         'America/New_York',               33.75,  -84.39, 0],
  ['Miami',           'America/New_York',               25.76,  -80.19, 0],
  ['Toronto',         'America/Toronto',                43.65,  -79.38, 0],
  ['Montreal',        'America/Toronto',                45.50,  -73.57, 0],
  ['New York',        'America/New_York',               40.71,  -74.01, 0],
  ['Washington',      'America/New_York',               38.91,  -77.04, 0],
  ['Boston',          'America/New_York',               42.36,  -71.06, 0],
  ['Halifax',         'America/Halifax',                44.65,  -63.57, 0],
  ["St. John's",      'America/St_Johns',               47.56,  -52.71, 0],
  ['Nuuk',            'America/Nuuk',                   64.18,  -51.72, 0],

  ['Mexiko-Stadt',    'America/Mexico_City',            19.43,  -99.13, 1],
  ['Havanna',         'America/Havana',                 23.11,  -82.37, 1],
  ['Panama-Stadt',    'America/Panama',                  8.98,  -79.52, 1],
  ['Bogotá',          'America/Bogota',                  4.71,  -74.07, 1],
  ['Caracas',         'America/Caracas',                10.48,  -66.90, 1],
  ['Quito',           'America/Guayaquil',              -0.18,  -78.47, 1],
  ['Lima',            'America/Lima',                  -12.05,  -77.04, 1],
  ['La Paz',          'America/La_Paz',                -16.49,  -68.12, 1],
  ['Santiago de Chile','America/Santiago',             -33.45,  -70.67, 1],
  ['Buenos Aires',    'America/Argentina/Buenos_Aires',-34.60,  -58.38, 1],
  ['Montevideo',      'America/Montevideo',            -34.90,  -56.16, 1],
  ['São Paulo',       'America/Sao_Paulo',             -23.55,  -46.63, 1],
  ['Rio de Janeiro',  'America/Sao_Paulo',             -22.91,  -43.17, 1],

  ['Reykjavík',       'Atlantic/Reykjavik',             64.15,  -21.94, 2],
  ['Dublin',          'Europe/Dublin',                  53.35,   -6.26, 2],
  ['Lissabon',        'Europe/Lisbon',                  38.72,   -9.14, 2],
  ['Madrid',          'Europe/Madrid',                  40.42,   -3.70, 2],
  ['London',          'Europe/London',                  51.51,   -0.13, 2],
  ['Paris',           'Europe/Paris',                   48.86,    2.35, 2],
  ['Amsterdam',       'Europe/Amsterdam',               52.37,    4.90, 2],
  ['Brüssel',         'Europe/Brussels',                50.85,    4.35, 2],
  ['Zürich',          'Europe/Zurich',                  47.38,    8.54, 2],
  ['Rom',             'Europe/Rome',                    41.90,   12.50, 2],
  ['Hamburg',         'Europe/Berlin',                  53.55,    9.99, 2],
  ['Berlin',          'Europe/Berlin',                  52.52,   13.40, 2],
  ['Köln',            'Europe/Berlin',                  50.94,    6.96, 2],
  ['Frankfurt',       'Europe/Berlin',                  50.11,    8.68, 2],
  ['München',         'Europe/Berlin',                  48.14,   11.58, 2],
  ['Wien',            'Europe/Vienna',                  48.21,   16.37, 2],
  ['Prag',            'Europe/Prague',                  50.08,   14.44, 2],
  ['Kopenhagen',      'Europe/Copenhagen',              55.68,   12.57, 2],
  ['Oslo',            'Europe/Oslo',                    59.91,   10.75, 2],
  ['Stockholm',       'Europe/Stockholm',               59.33,   18.07, 2],
  ['Warschau',        'Europe/Warsaw',                  52.23,   21.01, 2],
  ['Budapest',        'Europe/Budapest',                47.50,   19.04, 2],
  ['Helsinki',        'Europe/Helsinki',                60.17,   24.94, 2],
  ['Athen',           'Europe/Athens',                  37.98,   23.73, 2],
  ['Kiew',            'Europe/Kyiv',                    50.45,   30.52, 2],
  ['Istanbul',        'Europe/Istanbul',                41.01,   28.98, 2],
  ['Moskau',          'Europe/Moscow',                  55.76,   37.62, 2],

  ['Casablanca',      'Africa/Casablanca',              33.57,   -7.59, 3],
  ['Dakar',           'Africa/Dakar',                   14.72,  -17.47, 3],
  ['Accra',           'Africa/Accra',                    5.60,   -0.19, 3],
  ['Lagos',           'Africa/Lagos',                    6.52,    3.38, 3],
  ['Kairo',           'Africa/Cairo',                   30.04,   31.24, 3],
  ['Addis Abeba',     'Africa/Addis_Ababa',              9.03,   38.74, 3],
  ['Nairobi',         'Africa/Nairobi',                 -1.29,   36.82, 3],
  ['Kinshasa',        'Africa/Kinshasa',                -4.44,   15.27, 3],
  ['Johannesburg',    'Africa/Johannesburg',           -26.20,   28.05, 3],
  ['Kapstadt',        'Africa/Johannesburg',           -33.92,   18.42, 3],

  ['Tel Aviv',        'Asia/Jerusalem',                 32.09,   34.78, 4],
  ['Riad',            'Asia/Riyadh',                    24.71,   46.68, 4],
  ['Teheran',         'Asia/Tehran',                    35.69,   51.39, 4],
  ['Dubai',           'Asia/Dubai',                     25.20,   55.27, 4],
  ['Karatschi',       'Asia/Karachi',                   24.86,   67.01, 4],
  ['Almaty',          'Asia/Almaty',                    43.24,   76.89, 4],
  ['Neu-Delhi',       'Asia/Kolkata',                   28.61,   77.21, 4],
  ['Mumbai',          'Asia/Kolkata',                   19.08,   72.88, 4],
  ['Kathmandu',       'Asia/Kathmandu',                 27.72,   85.32, 4],
  ['Dhaka',           'Asia/Dhaka',                     23.81,   90.41, 4],
  ['Bangkok',         'Asia/Bangkok',                   13.76,  100.50, 4],
  ['Singapur',        'Asia/Singapore',                  1.35,  103.82, 4],
  ['Jakarta',         'Asia/Jakarta',                   -6.21,  106.85, 4],
  ['Hongkong',        'Asia/Hong_Kong',                 22.32,  114.17, 4],
  ['Manila',          'Asia/Manila',                    14.60,  120.98, 4],
  ['Peking',          'Asia/Shanghai',                  39.90,  116.40, 4],
  ['Shanghai',        'Asia/Shanghai',                  31.23,  121.47, 4],
  ['Seoul',           'Asia/Seoul',                     37.57,  126.98, 4],
  ['Tokio',           'Asia/Tokyo',                     35.68,  139.69, 4],
  ['Wladiwostok',     'Asia/Vladivostok',               43.12,  131.89, 4],

  ['Perth',           'Australia/Perth',               -31.95,  115.86, 5],
  ['Darwin',          'Australia/Darwin',              -12.46,  130.84, 5],
  ['Adelaide',        'Australia/Adelaide',            -34.93,  138.60, 5],
  ['Brisbane',        'Australia/Brisbane',            -27.47,  153.03, 5],
  ['Melbourne',       'Australia/Melbourne',           -37.81,  144.96, 5],
  ['Sydney',          'Australia/Sydney',              -33.87,  151.21, 5],
  ['Auckland',        'Pacific/Auckland',              -36.85,  174.76, 5],
  ['Suva (Fidschi)',  'Pacific/Fiji',                  -18.14,  178.44, 5],
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
  .map(([name, tz, lat, lon, r]) => ({ id: slugify(name), name, tz, lat, lon, region: REGIONS[r] }))
  .filter(c => isValidTimeZone(c.tz));

const DEFAULT_IDS = [
  'honolulu', 'anchorage', 'vancouver', 'los-angeles', 'denver', 'mexiko-stadt',
  'new-york', 'toronto', 'quito', 'lima', 'sao-paulo', 'nuuk', 'reykjavik',
  'lissabon', 'london', 'berlin', 'hamburg', 'lagos', 'kairo', 'moskau', 'nairobi',
  'johannesburg', 'dubai', 'neu-delhi', 'bangkok', 'singapur', 'peking', 'tokio',
  'perth', 'sydney', 'auckland',
];

const DEFAULT_SETTINGS = { selected: DEFAULT_IDS, custom: [], showWeather: false, showSun: true, showMoon: true };

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
  };
}

async function saveSettings(settings) {
  const data = {
    selected: settings.selected,
    custom: settings.custom,
    showWeather: !!settings.showWeather,
    showSun: settings.showSun !== false,
    showMoon: settings.showMoon !== false,
  };
  if (hasChromeStorage) await chrome.storage.sync.set(data);
  else localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function onSettingsChanged(callback) {
  if (hasChromeStorage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && (changes.selected || changes.custom || changes.showWeather || changes.showSun || changes.showMoon)) loadSettings().then(callback);
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
