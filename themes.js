'use strict';

// Farb-Themes für Neuer-Tab- und Einstellungsseite.
// Wird im <head> geladen, damit das zuletzt genutzte Theme ohne Aufblitzen sofort greift.

// Bearbeitbare Farben eines Themes (alle als #rrggbb) plus Nacht-Intensität (0–1).
// Beschriftungen: tr('group.<group>') und tr('field.<key>') (i18n.js); Theme-Namen: themeName().
const THEME_FIELDS = [
  { group: 'map',     key: 'oceanTop' },
  { group: 'map',     key: 'oceanBottom' },
  { group: 'map',     key: 'land' },
  { group: 'map',     key: 'border' },
  { group: 'map',     key: 'night' },
  { group: 'markers', key: 'accent' },
  { group: 'markers', key: 'local' },
  { group: 'markers', key: 'sun' },
  { group: 'surface', key: 'bg' },
  { group: 'surface', key: 'label' },
  { group: 'surface', key: 'text' },
  { group: 'surface', key: 'muted' },
];

const THEMES = [
  {
    id: 'nacht',
    colors: {
      bg: '#0a0f1c', text: '#e6ebf5', muted: '#8b95ab', label: '#080c18',
      accent: '#5cc8ff', local: '#ffb04a', sun: '#ffe066',
      oceanTop: '#0f1d33', oceanBottom: '#0b1526', land: '#25344f', border: '#a0b4d7',
      night: '#020510', nightAlpha: 0.7,
    },
  },
  {
    id: 'hell',
    colors: {
      bg: '#eef2f7', text: '#1b2433', muted: '#5d6b82', label: '#ffffff',
      accent: '#0a7fd0', local: '#d96f00', sun: '#f2b200',
      oceanTop: '#cfe3f5', oceanBottom: '#b7d2ea', land: '#fbf8f1', border: '#7f94b0',
      night: '#1a2a4a', nightAlpha: 0.35,
    },
  },
  {
    id: 'atlas',
    colors: {
      bg: '#f3ead8', text: '#3a2f22', muted: '#7a6a55', label: '#fbf5e8',
      accent: '#b0412e', local: '#2e6f8e', sun: '#e09a10',
      oceanTop: '#a9cbd6', oceanBottom: '#8db6c4', land: '#ead9b0', border: '#8f7a55',
      night: '#1d2433', nightAlpha: 0.45,
    },
  },
  {
    id: 'ozean',
    colors: {
      bg: '#031a24', text: '#e0f7fa', muted: '#7fa8b5', label: '#021018',
      accent: '#4dd0e1', local: '#ff8a65', sun: '#fff176',
      oceanTop: '#05324a', oceanBottom: '#021c2b', land: '#1e5a5a', border: '#6fb8b8',
      night: '#000a12', nightAlpha: 0.65,
    },
  },
  {
    id: 'abendrot',
    colors: {
      bg: '#1a0f1f', text: '#fbe9e7', muted: '#b08fa0', label: '#140a18',
      accent: '#ff7eb6', local: '#ffb347', sun: '#ffd36e',
      oceanTop: '#2b1838', oceanBottom: '#1c1026', land: '#4a2a4f', border: '#a070a0',
      night: '#0b0510', nightAlpha: 0.65,
    },
  },
  {
    id: 'terminal',
    colors: {
      bg: '#050a05', text: '#c8f7c5', muted: '#5f8f5c', label: '#020602',
      accent: '#39ff88', local: '#ffcc33', sun: '#ffee88',
      oceanTop: '#061206', oceanBottom: '#030903', land: '#0f2a12', border: '#3f8f46',
      night: '#000000', nightAlpha: 0.6,
    },
  },
  {
    id: 'herbst',
    colors: {
      bg: '#1c120b', text: '#f5e6d3', muted: '#a88f74', label: '#140c07',
      accent: '#ff8c3a', local: '#e0574a', sun: '#ffd25e',
      oceanTop: '#22302d', oceanBottom: '#161f1d', land: '#5a3a1e', border: '#c28a4f',
      night: '#0a0603', nightAlpha: 0.65,
    },
  },
  {
    id: 'kontrast',
    colors: {
      bg: '#000000', text: '#ffffff', muted: '#d6d6d6', label: '#000000',
      accent: '#ffff00', local: '#00ffff', sun: '#ffb000',
      oceanTop: '#001a40', oceanBottom: '#000c24', land: '#3a3a3a', border: '#ffffff',
      night: '#000000', nightAlpha: 0.5,
    },
  },
  {
    id: 'rose',
    colors: {
      bg: '#fbeef1', text: '#4a2233', muted: '#8f6474', label: '#fffafb',
      accent: '#d6336c', local: '#9b4dca', sun: '#f0a020',
      oceanTop: '#f6d3dd', oceanBottom: '#eebfcd', land: '#fffaf8', border: '#c88aa0',
      night: '#4a1a33', nightAlpha: 0.3,
    },
  },
  {
    id: 'neon',
    colors: {
      bg: '#0b0614', text: '#f2eaff', muted: '#9a88c0', label: '#07030e',
      accent: '#ff2bd6', local: '#00f0ff', sun: '#faff00',
      oceanTop: '#120a2a', oceanBottom: '#0a0518', land: '#1d1240', border: '#b026ff',
      night: '#000000', nightAlpha: 0.6,
    },
  },
  {
    id: 'gold',
    colors: {
      bg: '#14110a', text: '#f7ecd2', muted: '#a8996f', label: '#0e0b06',
      accent: '#e6b84a', local: '#ff9f5a', sun: '#fff3b0',
      oceanTop: '#1b1810', oceanBottom: '#110f09', land: '#3d3220', border: '#d4af37',
      night: '#050402', nightAlpha: 0.65,
    },
  },
  {
    id: 'wiese',
    colors: {
      bg: '#eef5e6', text: '#1f3320', muted: '#5e7558', label: '#fbfdf7',
      accent: '#2a7d34', local: '#d2462f', sun: '#f2b705',
      oceanTop: '#cfe6ea', oceanBottom: '#b5d6dc', land: '#a8d08d', border: '#5c8a4a',
      night: '#1b2f1f', nightAlpha: 0.35,
    },
  },
];

const themeName = id => tr('theme.' + id);

const DEFAULT_THEME_ID = 'nacht';
const CUSTOM_THEME_ID = 'custom';
const DEFAULT_THEME_STATE = { theme: DEFAULT_THEME_ID, customTheme: null };

// ---------- Farb-Hilfsfunktionen ----------

const HEX_RE = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Lineare Mischung zweier Farben, t = Anteil von b.
function mixHex(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------- Theme auflösen ----------

function presetById(id) {
  return THEMES.find(t => t.id === id) || THEMES.find(t => t.id === DEFAULT_THEME_ID);
}

// Eigenes Theme bereinigen: ungültige/fehlende Werte aus dem Standard-Theme ergänzen.
function sanitizeColors(colors, base = presetById(DEFAULT_THEME_ID).colors) {
  const out = { ...base };
  if (colors && typeof colors === 'object') {
    for (const { key } of THEME_FIELDS) {
      if (typeof colors[key] === 'string' && HEX_RE.test(colors[key])) out[key] = colors[key].toLowerCase();
    }
    const a = Number(colors.nightAlpha);
    if (Number.isFinite(a)) out.nightAlpha = Math.min(0.95, Math.max(0, a));
  }
  return out;
}

function resolveTheme(state) {
  if (state.theme === CUSTOM_THEME_ID && state.customTheme) return sanitizeColors(state.customTheme);
  return { ...presetById(state.theme).colors };
}

// CSS-Variablen für beide Seiten setzen.
function applyThemeCss(c) {
  const dark = luminance(c.bg) < 0.4;
  const vars = {
    '--bg': c.bg,
    '--bg-glow': mixHex(c.bg, c.text, 0.04),
    // Dunkle Themes: Flächen etwas heller als der Hintergrund, helle Themes: fast weiß.
    '--panel': dark ? mixHex(c.bg, c.text, 0.04) : mixHex(c.bg, '#ffffff', 0.7),
    '--panel-2': mixHex(c.bg, c.text, dark ? 0.08 : 0.05),
    '--text': c.text,
    '--muted': c.muted,
    '--accent': c.accent,
    '--on-accent': luminance(c.accent) > 0.35 ? '#0b1220' : '#ffffff',
    '--local': c.local,
    '--sun': c.sun,
    '--line': rgba(c.text, dark ? 0.08 : 0.14),
    '--shadow': dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(30, 40, 60, 0.18)',
    '--danger': dark ? '#ff7a7a' : '#c62828',
    '--ok': dark ? '#6fdc9a' : '#1b7f45',
    'color-scheme': dark ? 'dark' : 'light',
  };
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  try { localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(c)); } catch { /* egal */ }
}

// ---------- Speicher ----------

const THEME_CACHE_KEY = 'weltzeit-theme-cache';
const THEME_LS_KEY = 'weltzeit-theme';
const hasThemeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

async function loadThemeState() {
  let s;
  if (hasThemeStorage) {
    s = await chrome.storage.sync.get(DEFAULT_THEME_STATE);
  } else {
    try { s = JSON.parse(localStorage.getItem(THEME_LS_KEY)) || {}; } catch { s = {}; }
  }
  const valid = s.theme === CUSTOM_THEME_ID || THEMES.some(t => t.id === s.theme);
  return {
    theme: valid ? s.theme : DEFAULT_THEME_ID,
    customTheme: s.customTheme ? sanitizeColors(s.customTheme) : null,
  };
}

async function saveThemeState(state) {
  const data = { theme: state.theme, customTheme: state.customTheme };
  if (hasThemeStorage) await chrome.storage.sync.set(data);
  else localStorage.setItem(THEME_LS_KEY, JSON.stringify(data));
}

function onThemeChanged(callback) {
  if (hasThemeStorage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && (changes.theme || changes.customTheme)) loadThemeState().then(callback);
    });
  } else {
    window.addEventListener('storage', e => { if (e.key === THEME_LS_KEY) loadThemeState().then(callback); });
  }
}

// Sofort das zuletzt angewendete Theme setzen (vor dem ersten Rendern).
(function applyCachedTheme() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(THEME_CACHE_KEY)); } catch { /* egal */ }
  applyThemeCss(sanitizeColors(cached));
})();
