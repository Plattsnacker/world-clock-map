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

// ---------- Hilfsfunktionen ----------

const timeFmt = new Map();
function timeIn(tz) {
  if (!timeFmt.has(tz)) {
    timeFmt.set(tz, new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }));
  }
  return timeFmt.get(tz).format(new Date());
}

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

let statusTimer;
async function persist() {
  await saveSettings(settings);
  statusEl.textContent = 'Gespeichert ✓';
  statusEl.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('show'), 1500);
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
      el('div', { className: 'name', textContent: city.name }),
      el('div', { className: 'tz', textContent: city.tz.replace(/_/g, ' ') }),
    ]),
    time,
  ]);
  card.dataset.id = city.id;
  card.dataset.search = `${city.name} ${city.tz} ${city.region || ''}`.toLowerCase();

  cb.addEventListener('change', () => {
    setSelected(city.id, cb.checked);
    card.classList.toggle('on', cb.checked);
    updateCounts();
    persist();
  });

  if (removable) {
    const btn = el('button', { type: 'button', className: 'remove', textContent: '×', title: 'Entfernen' });
    btn.setAttribute('aria-label', `${city.name} entfernen`);
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

    const allBtn = el('button', { type: 'button', className: 'link', textContent: 'alle' });
    const noneBtn = el('button', { type: 'button', className: 'link', textContent: 'keine' });
    allBtn.addEventListener('click', () => bulk(grid, true));
    noneBtn.addEventListener('click', () => bulk(grid, false));

    const section = el('section', { className: 'region' }, [
      el('div', { className: 'region-head' }, [
        el('h2', { textContent: region }),
        el('span', { className: 'rcount' }),
        allBtn, noneBtn,
      ]),
      grid,
    ]);
    regionsEl.append(section);
  }
  regionsEl.append(el('p', { className: 'empty-search', id: 'emptySearch', hidden: true, textContent: 'Keine Stadt gefunden.' }));
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
  countEl.textContent = `${n} von ${known.size} ausgewählt`;

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

formEl.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(formEl);
  const name = String(f.get('name') || '').trim();
  const tz = String(f.get('tz') || '').trim();
  const lat = parseFloat(String(f.get('lat')).replace(',', '.'));
  const lon = parseFloat(String(f.get('lon')).replace(',', '.'));

  let err = '';
  if (!name) err = 'Bitte einen Namen eingeben.';
  else if (!isValidTimeZone(tz)) err = `„${tz}“ ist keine gültige Zeitzone (Format z. B. Europe/Berlin).`;
  else if (!(lat >= -90 && lat <= 90)) err = 'Der Breitengrad muss zwischen −90 und 90 liegen.';
  else if (!(lon >= -180 && lon <= 180)) err = 'Der Längengrad muss zwischen −180 und 180 liegen.';
  formErrorEl.textContent = err;
  if (err) return;

  const city = { id: 'custom-' + Date.now().toString(36), name, tz, lat, lon };
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
  if (!confirm('Auswahl auf die Standardstädte zurücksetzen? Eigene Städte bleiben erhalten, werden aber abgewählt.')) return;
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

// ---------- Start ----------

(async function init() {
  settings = await loadSettings();
  fillTimeZoneList();
  renderAll();

  setInterval(() => {
    for (const [e, tz] of timeEls) if (e.isConnected) e.textContent = timeIn(tz);
  }, 15000);
})();
