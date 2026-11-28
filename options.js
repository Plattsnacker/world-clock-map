'use strict';

let settings = { selected: [], custom: [] };
const timeEls = []; // [element, tz]

const regionsEl = document.getElementById('regions');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');
const customListEl = document.getElementById('customList');
const customEmptyEl = document.getElementById('customEmpty');
const formEl = document.getElementById('customForm');
const formErrorEl = document.getElementById('formError');

// Versionsnummer aus dem Manifest, damit sie nur dort gepflegt werden muss.
try {
  document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version;
} catch { /* außerhalb der Erweiterung geöffnet */ }

// ---------- Hilfsfunktionen ----------

const timeFmt = new Map();
function timeIn(tz) {
  if (!timeFmt.has(tz)) {
    timeFmt.set(tz, new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }));
  }
  return formatClock(timeFmt.get(tz).format(new Date()), settings.clock);
}

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

let statusTimer;
function showSaved() {
  statusEl.textContent = tr('opt.saved');
  statusEl.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('show'), 1500);
}

async function persist() {
  await saveSettings(settings);
  showSaved();
}

function isSelected(id) { return settings.selected.includes(id); }

function setSelected(id, on) {
  const has = isSelected(id);
  if (on && !has) settings.selected.push(id);
  if (!on && has) settings.selected = settings.selected.filter(x => x !== id);
}

// ---------- Karten ----------

function cityCard(city, { removable = false } = {}) {
  const cb = el('input', { type: 'checkbox', checked: isSelected(city.id) });
  const time = el('span', { className: 'time', textContent: timeIn(city.tz) });
  timeEls.push([time, city.tz]);

  const card = el('label', { className: 'city' + (cb.checked ? ' on' : '') }, [
    cb,
    el('span', { className: 'info' }, [
      el('div', { className: 'name' }, [
        ...(hasFlag(city.country)
          ? [el('img', { className: 'flag', src: flagUrl(city.country), alt: '', title: countryName(city.country) })]
          : []),
        city.name,
      ]),
      el('div', { className: 'tz', textContent: city.tz.replace(/_/g, ' ') }),
    ]),
    time,
  ]);
  card.dataset.id = city.id;
  const country = hasFlag(city.country) ? countryName(city.country) : '';
  // ID mitsuchen, damit auch frühere (deutsche) Namen wie „Moskau“ gefunden werden.
  const region = city.region ? regionName(city.region) : '';
  card.dataset.search = `${city.name} ${city.id} ${city.tz} ${region} ${country}`.toLowerCase();

  cb.addEventListener('change', () => {
    setSelected(city.id, cb.checked);
    card.classList.toggle('on', cb.checked);
    updateCounts();
    persist();
  });

  if (removable) {
    const btn = el('button', { type: 'button', className: 'remove', textContent: '×', title: tr('opt.remove') });
    btn.setAttribute('aria-label', tr('opt.removeCity', { name: city.name }));
    btn.addEventListener('click', e => {
      e.preventDefault();
      settings.custom = settings.custom.filter(c => c.id !== city.id);
      setSelected(city.id, false);
      renderCustom();
      updateCounts();
      persist();
    });
    card.append(btn);
  }
  return card;
}

function renderRegions() {
  regionsEl.textContent = '';
  for (const region of REGIONS) {
    const cities = CATALOG.filter(c => c.region === region);
    const grid = el('div', { className: 'grid' }, cities.map(c => cityCard(c)));

    const allBtn = el('button', { type: 'button', className: 'link', textContent: tr('opt.regionAll') });
    const noneBtn = el('button', { type: 'button', className: 'link', textContent: tr('opt.regionNone') });
    allBtn.addEventListener('click', () => bulk(grid, true));
    noneBtn.addEventListener('click', () => bulk(grid, false));

    const section = el('section', { className: 'region' }, [
      el('div', { className: 'region-head' }, [
        el('h2', { textContent: regionName(region) }),
        el('span', { className: 'rcount' }),
        allBtn, noneBtn,
      ]),
      grid,
    ]);
    regionsEl.append(section);
  }
  regionsEl.append(el('p', { className: 'empty-search', id: 'emptySearch', hidden: true, textContent: tr('opt.emptySearch') }));
}

function renderCustom() {
  customListEl.textContent = '';
  for (let i = timeEls.length - 1; i >= 0; i--) if (!timeEls[i][0].isConnected) timeEls.splice(i, 1);
  settings.custom.forEach(c => customListEl.append(cityCard(c, { removable: true })));
  customEmptyEl.hidden = settings.custom.length > 0;
  applySearch();
}

// Alle (sichtbaren) Karten eines Containers an- oder abwählen.
function bulk(container, on) {
  container.querySelectorAll('.city:not([hidden])').forEach(card => {
    const cb = card.querySelector('input[type="checkbox"]');
    cb.checked = on;
    card.classList.toggle('on', on);
    setSelected(card.dataset.id, on);
  });
  updateCounts();
  persist();
}

function updateCounts() {
  const known = new Set([...CATALOG, ...settings.custom].map(c => c.id));
  const n = settings.selected.filter(id => known.has(id)).length;
  countEl.textContent = tr('opt.count', { n, total: known.size });

  regionsEl.querySelectorAll('.region').forEach(sec => {
    const cards = sec.querySelectorAll('.city');
    const on = sec.querySelectorAll('.city.on').length;
    sec.querySelector('.rcount').textContent = `${on} / ${cards.length}`;
  });
}

function applySearch() {
  const q = searchEl.value.trim().toLowerCase();
  let anyVisible = false;
  document.querySelectorAll('.city').forEach(card => {
    const match = !q || card.dataset.search.includes(q);
    card.hidden = !match;
    if (match) anyVisible = true;
  });
  regionsEl.querySelectorAll('.region').forEach(sec => {
    sec.hidden = !sec.querySelector('.city:not([hidden])');
  });
  const empty = document.getElementById('emptySearch');
  if (empty) empty.hidden = anyVisible;
}

// ---------- Eigene Städte ----------

function fillTimeZoneList() {
  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [...new Set(CATALOG.map(c => c.tz))].sort();
  const list = document.getElementById('tzList');
  zones.forEach(z => list.append(el('option', { value: z })));
}

function fillCountryList() {
  const select = formEl.elements.country;
  const countries = [...FLAG_CODES]
    .map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
  countries.forEach(c => select.append(el('option', { value: c.code, textContent: c.name })));
}

formEl.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(formEl);
  const name = String(f.get('name') || '').trim();
  const tz = String(f.get('tz') || '').trim();
  const lat = parseFloat(String(f.get('lat')).replace(',', '.'));
  const lon = parseFloat(String(f.get('lon')).replace(',', '.'));

  let err = '';
  if (!name) err = tr('err.name');
  else if (!isValidTimeZone(tz)) err = tr('err.tz', { tz });
  else if (!(lat >= -90 && lat <= 90)) err = tr('err.lat');
  else if (!(lon >= -180 && lon <= 180)) err = tr('err.lon');
  formErrorEl.textContent = err;
  if (err) return;

  const country = String(f.get('country') || '');
  const city = { id: 'custom-' + Date.now().toString(36), name, tz, lat, lon };
  if (hasFlag(country)) city.country = country;
  settings.custom.push(city);
  settings.selected.push(city.id);
  formEl.reset();
  renderCustom();
  updateCounts();
  persist();
});

// ---------- Toolbar ----------

searchEl.addEventListener('input', applySearch);
document.getElementById('selectAll').addEventListener('click', () => bulk(document, true));
document.getElementById('selectNone').addEventListener('click', () => bulk(document, false));
document.getElementById('reset').addEventListener('click', () => {
  if (!confirm(tr('opt.confirmReset'))) return;
  settings.selected = [...DEFAULT_IDS];
  renderAll();
  persist();
});

function renderAll() {
  timeEls.length = 0;
  renderRegions();
  renderCustom();
  updateCounts();
}

// ---------- Farbschema ----------

let themeState = { ...DEFAULT_THEME_STATE };
const themeListEl = document.getElementById('themeList');
const themeEditorEl = document.getElementById('themeEditor');
const editorFieldsEl = document.getElementById('editorFields');
const copyFromEl = document.getElementById('copyFrom');
const colorInputs = new Map(); // key -> { picker, hex }
let nightInput, nightValue;

// Mini-Karte als Vorschau eines Themes.
function themePreview(c) {
  const p = el('div', { className: 'preview' });
  const vars = {
    '--p-bg': c.bg, '--p-o1': c.oceanTop, '--p-o2': c.oceanBottom, '--p-land': c.land,
    '--p-border': c.border, '--p-night': rgba(c.night, c.nightAlpha), '--p-acc': c.accent,
    '--p-loc': c.local, '--p-sun': c.sun, '--p-label': c.label, '--p-text': c.text,
  };
  for (const [k, v] of Object.entries(vars)) p.style.setProperty(k, v);
  p.innerHTML = '<div class="p-map"><i class="p-land l1"></i><i class="p-land l2"></i><i class="p-land l3"></i>'
    + '<i class="p-night"></i><i class="p-dot d1"></i><i class="p-dot d2"></i><i class="p-dot p-sun"></i>'
    + '<i class="p-label"></i></div>';
  return p;
}

function renderThemeList() {
  themeListEl.textContent = '';
  const custom = {
    id: CUSTOM_THEME_ID,
    name: themeName(CUSTOM_THEME_ID),
    colors: themeState.customTheme || resolveTheme(themeState),
  };
  for (const t of [...THEMES, custom]) {
    const on = themeState.theme === t.id;
    const card = el('button', { type: 'button', className: 'theme-card' + (on ? ' on' : '') }, [
      themePreview(t.colors),
      el('span', { className: 'theme-name', textContent: t.name || themeName(t.id) }),
    ]);
    if (t.id === CUSTOM_THEME_ID) {
      card.classList.add('custom');
      card.querySelector('.theme-name').append(el('span', { className: 'badge', textContent: tr('opt.customizable') }));
    }
    card.dataset.id = t.id;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(on));
    card.addEventListener('click', () => selectTheme(t.id));
    themeListEl.append(card);
  }
}

function selectTheme(id) {
  // Beim ersten Öffnen startet das eigene Theme mit den Farben des aktuell gewählten.
  if (id === CUSTOM_THEME_ID && !themeState.customTheme) themeState.customTheme = resolveTheme(themeState);
  themeState.theme = id;
  applyThemeCss(resolveTheme(themeState));
  renderThemeList();
  renderEditor();
  persistTheme();
}

let themeSaveTimer;
function persistTheme() {
  // Entprellt, damit Farbwähler-Ziehen nicht das Schreiblimit von storage.sync sprengt.
  clearTimeout(themeSaveTimer);
  themeSaveTimer = setTimeout(async () => {
    await saveThemeState(themeState);
    showSaved();
  }, 350);
}

function setCustomValue(key, value) {
  themeState.customTheme = { ...themeState.customTheme, [key]: value };
  customThemeChanged();
}

function customThemeChanged() {
  applyThemeCss(resolveTheme(themeState));
  syncEditor();
  const card = themeListEl.querySelector(`[data-id="${CUSTOM_THEME_ID}"]`);
  if (card) card.querySelector('.preview').replaceWith(themePreview(themeState.customTheme));
  persistTheme();
}

function buildEditor() {
  copyFromEl.append(
    el('option', { value: '', textContent: tr('opt.chooseTheme') }),
    ...THEMES.map(theme => el('option', { value: theme.id, textContent: themeName(theme.id) })),
  );
  copyFromEl.addEventListener('change', () => {
    if (!copyFromEl.value) return;
    themeState.customTheme = { ...presetById(copyFromEl.value).colors };
    copyFromEl.value = '';
    customThemeChanged();
  });

  let group = null, groupEl = null;
  for (const f of THEME_FIELDS) {
    if (f.group !== group) {
      group = f.group;
      groupEl = el('fieldset', { className: 'field-group' }, [el('legend', { textContent: tr('group.' + group) })]);
      editorFieldsEl.append(groupEl);
    }
    const picker = el('input', { type: 'color' });
    const label = tr('field.' + f.key);
    picker.setAttribute('aria-label', label);
    picker.addEventListener('input', () => setCustomValue(f.key, picker.value));

    const hex = el('input', { type: 'text', className: 'hex', maxLength: 7, spellcheck: false });
    hex.setAttribute('aria-label', tr('opt.hexValue', { label }));
    hex.addEventListener('change', () => {
      let v = hex.value.trim().toLowerCase();
      if (!v.startsWith('#')) v = '#' + v;
      if (HEX_RE.test(v)) setCustomValue(f.key, v);
      else hex.value = themeState.customTheme[f.key];
    });

    groupEl.append(el('div', { className: 'field' }, [
      el('label', { className: 'swatch' }, [picker]),
      el('span', { className: 'field-label', textContent: label }),
      hex,
    ]));
    colorInputs.set(f.key, { picker, hex });

    if (f.key === 'night') {
      nightInput = el('input', { type: 'range', min: 0, max: 95, step: 5 });
      nightInput.setAttribute('aria-label', tr('opt.nightIntensity'));
      nightValue = el('span', { className: 'range-value' });
      nightInput.addEventListener('input', () => setCustomValue('nightAlpha', nightInput.value / 100));
      groupEl.append(el('div', { className: 'field range' }, [
        el('span', { className: 'field-label', textContent: tr('opt.nightIntensity') }),
        nightInput,
        nightValue,
      ]));
    }
  }
}

function syncEditor() {
  const c = themeState.customTheme;
  if (!c) return;
  for (const [key, { picker, hex }] of colorInputs) {
    picker.value = c[key];
    if (document.activeElement !== hex) hex.value = c[key];
  }
  nightInput.value = Math.round(c.nightAlpha * 100);
  nightValue.textContent = `${nightInput.value} %`;
}

function renderEditor() {
  themeEditorEl.hidden = themeState.theme !== CUSTOM_THEME_ID;
  syncEditor();
}

// ---------- Start ----------

(async function init() {
  applyI18n();
  [themeState, settings] = await Promise.all([loadThemeState(), loadSettings()]);
  // Die Sprache steht erst nach dem Laden fest (der localStorage-Cache kann abweichen).
  if (settings.lang !== LANG) { setLanguage(settings.lang); applyI18n(); }

  applyThemeCss(resolveTheme(themeState));
  buildEditor();
  renderThemeList();
  renderEditor();

  // Sprachwechsel: speichern und die Seite neu aufbauen; offene Tabs übernehmen ihn live.
  const langEl = document.getElementById('lang');
  for (const l of LANGUAGES) langEl.append(el('option', { value: l.code, textContent: l.name, lang: l.code }));
  langEl.value = settings.lang;
  langEl.addEventListener('change', async () => {
    settings.lang = langEl.value;
    setLanguage(settings.lang);
    await persist();
    location.reload();
  });

  const quakeMagEl = document.getElementById('quakeMinMag');
  const syncQuakeRow = () => {
    quakeMagEl.disabled = !settings.showQuakes;
    document.getElementById('quakeMinMagRow').classList.toggle('disabled', !settings.showQuakes);
  };

  for (const key of ['showSun', 'showMoon', 'showFlags', 'showWeather', 'centerNoon', 'showIss', 'showQuakes', 'showAurora', 'showStorms', 'showGrid', 'showWorkHours']) {
    const cb = document.getElementById(key);
    cb.checked = settings[key];
    cb.addEventListener('change', () => {
      settings[key] = cb.checked;
      syncQuakeRow();
      persist();
    });
  }

  for (const m of QUAKE_MAGNITUDES) {
    const label = formatNumber(m, 1);
    quakeMagEl.append(el('option', { value: String(m), textContent: tr('opt.magFrom', { m: label }) }));
  }
  quakeMagEl.value = String(settings.quakeMinMag);
  quakeMagEl.addEventListener('change', () => {
    settings.quakeMinMag = Number(quakeMagEl.value);
    persist();
  });
  syncQuakeRow();

  const updateTimes = () => {
    for (const [e, tz] of timeEls) if (e.isConnected) e.textContent = timeIn(tz);
  };

  for (const key of ['clock', 'tempUnit']) {
    for (const radio of document.querySelectorAll(`input[name="${key}"]`)) {
      radio.checked = radio.value === settings[key];
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        settings[key] = radio.value;
        if (key === 'clock') updateTimes();
        persist();
      });
    }
  }

  fillTimeZoneList();
  fillCountryList();
  renderAll();

  setInterval(updateTimes, 15000);
})();
