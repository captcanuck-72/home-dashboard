/* ==========================================================================
   Home Dashboard · app.js
   Plain JavaScript, no build step, written for an iPad on the wall.

   Data sources
     • Weather   → Open-Meteo (free, no key)
     • Calendar, Tasks, Groceries, Lunches → your own Google Apps Script
       web app (see apps-script/Code.gs). Until you connect one in Settings,
       the dashboard runs on demo data (and lists are saved on this device).
   ========================================================================== */
(function () {
  'use strict';

  /* ──────────────────────────── helpers ──────────────────────────── */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const DAY = 864e5;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function parseYmd(s) {
    const p = String(s).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  // "2026-11-22T14:00" (no offset) → local time. Older Safari treats these as UTC.
  function parseLocal(s) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : new Date(s);
  }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode / full */ }
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timed out')), ms);
      promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }
  function fetchJSON(url, opts, ms) {
    return withTimeout(fetch(url, opts || undefined), ms || 20000)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((txt) => {
        try { return JSON.parse(txt); } catch (e) {
          const err = new Error('Unexpected response'); err.code = 'BADJSON'; throw err;
        }
      });
  }

  // Replace a container's HTML only when it changed, and keep its scroll position.
  function setHTML(el, html) {
    if (!el || el._html === html) return;
    const top = el.scrollTop;
    el.innerHTML = html;
    el._html = html;
    el.scrollTop = top;
  }

  const listJoin = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  const safeColor = (c) => /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#7aa7ff';

  /* ──────────────────────────── icons ──────────────────────────── */

  const ICONS = {
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    check: '<path d="M9 11.5l3 3L21 5"/><path d="M20 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.8-1.4L21.5 7H6"/>',
    video: '<path d="M22 7.5l-6 4.5 6 4.5z"/><rect x="2" y="5" width="14" height="14" rx="2.5"/>',
    utensils: '<path d="M4 2.5V9a2.5 2.5 0 0 0 5 0V2.5M6.5 2.5v19M20 15V2.5A4.5 4.5 0 0 0 15.5 7v6a2 2 0 0 0 2 2H20zm0 0v6.5"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10.5a7 7 0 0 1-14 0M12 17.5V22M8.5 22h7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sparkle: '<path d="M12 3.5l1.8 4.9 4.9 1.8-4.9 1.8L12 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    external: '<path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5M15 3h6v6M10 14L21 3"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    alert: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  };
  const icon = (name, cls) =>
    '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

  /* ──────────────────────────── settings ──────────────────────────── */

  const LANG = navigator.language || 'en-US';
  const LOCALE_12H = /[ap]\.?\s?m\.?/i.test(new Date(2020, 0, 1, 13).toLocaleTimeString(LANG));

  const DEFAULT_AI =
    'Claude | https://claude.ai/new?q=%s\n' +
    'ChatGPT | https://chatgpt.com/?q=%s\n' +
    'Gemini | https://gemini.google.com/app\n' +
    'Perplexity | https://www.perplexity.ai/search?q=%s';

  const DEFAULTS = {
    apiUrl: '',
    apiKey: '',
    place: '',
    lat: null,
    lon: null,
    units: LANG === 'en-US' ? 'F' : 'C',
    clock24: !LOCALE_12H,
    theme: 'dark',
    calendarDays: 7,
    calendarIds: null, // null = follow the calendars ticked in Google Calendar; or an array of IDs picked in Settings
    childName: '',
    nightMode: true,
    nightStart: '22:00',
    nightEnd: '06:00',
    camMode: 'none',
    camUrl: '',
    camRefresh: 10,
    camTapToPlay: false,
    camLink: '',
    camLinkLabel: '',
    aiLinks: DEFAULT_AI,
  };

  let S = Object.assign({}, DEFAULTS, load('hd.settings', {}));
  const saveSettings = () => save('hd.settings', S);
  const isDemo = () => !S.apiUrl;

  // Setup links: all settings packed into the URL (#setup=…) so you can configure
  // on a computer and move them to the iPad.
  function encodeSetup(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
  function decodeSetup(str) { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
  function setupLink(obj) { return location.href.split('#')[0] + '#setup=' + encodeURIComponent(encodeSetup(obj)); }
  function readSetupLink(text) {
    const m = /[#&]setup=([^&\s]+)/.exec(text || '');
    if (!m) throw new Error('That doesn’t look like a setup link');
    const obj = decodeSetup(decodeURIComponent(m[1]));
    const clean = {};
    Object.keys(DEFAULTS).forEach((k) => { if (Object.prototype.hasOwnProperty.call(obj, k)) clean[k] = obj[k]; });
    return { settings: clean, token: m[1] };
  }
  let importedFromHash = false;
  (function importFromHash() {
    if (!/[#&]setup=/.test(location.hash)) return;
    try {
      const r = readSetupLink(location.hash);
      if (load('hd.lastSetup', '') === r.token) return; // already applied in this storage
      Object.assign(S, r.settings);
      saveSettings();
      save('hd.lastSetup', r.token);
      importedFromHash = true;
    } catch (e) { console.warn('Bad setup link', e); }
  })();

  /* ──────────────────────────── state ──────────────────────────── */

  const emptyData = () => ({ events: [], tasks: [], taskLists: [], groceries: [], lunches: {}, errors: {}, loaded: false });
  let data = emptyData();
  if (!isDemo()) {
    const cached = load('hd.cache', null);
    if (cached && cached.apiUrl === S.apiUrl && cached.data) data = Object.assign(emptyData(), cached.data, { errors: {} });
  }
  let sync = { state: 'idle', at: null, msg: '' };
  let weather = null;
  let weatherErr = '';
  let modalOpen = false;

  /* ──────────────────────────── API ──────────────────────────── */

  function api(action, payload, cfg) {
    cfg = cfg || S;
    const body = JSON.stringify(Object.assign({ action: action, key: cfg.apiKey }, payload || {}));
    // No custom headers → a "simple" CORS request, which Apps Script accepts without a preflight.
    return fetchJSON(cfg.apiUrl, { method: 'POST', body: body, redirect: 'follow' }, 30000)
      .catch((err) => {
        if (err.code === 'BADJSON') throw new Error('Google sent back a web page instead of data. Check the web app is deployed with access set to “Anyone”.');
        if (err instanceof TypeError) throw new Error('Can’t reach Google. Check the web app URL and the internet connection.');
        throw err;
      })
      .then((res) => {
        if (!res || !res.ok) throw new Error((res && res.error) || 'Request failed');
        return res;
      });
  }

  function calRange() {
    const from = startOfDay(new Date());
    return { from: from.toISOString(), to: addDays(from, S.calendarDays).toISOString() };
  }

  const Backend = {
    loadAll: () => isDemo()
      ? Promise.resolve(Demo.loadAll())
      : api('all', Object.assign(calRange(), Array.isArray(S.calendarIds) ? { calendars: S.calendarIds } : {})),
    listCalendars: () => isDemo() ? Promise.resolve(Demo.calendars()) : api('calendars').then((r) => r.calendars || []),
    completeTask: (t) => isDemo() ? Promise.resolve(Demo.completeTask(t)) : api('completeTask', { listId: t.listId, taskId: t.id }),
    addGroceries: (items) => isDemo() ? Promise.resolve(Demo.addGroceries(items)) : api('addGrocery', { items: items }),
    checkGrocery: (id) => isDemo() ? Promise.resolve(Demo.checkGrocery(id)) : api('checkGrocery', { id: id }),
    setLunches: (map) => isDemo() ? Promise.resolve(Demo.setLunches(map)) : api('setLunches', { lunches: map }),
  };

  /* ──────────────────────────── demo data ──────────────────────────── */

  const Demo = (function () {
    const CALS = {
      family: { name: 'Family', color: '#039be5' },
      work: { name: 'Work', color: '#f4511e' },
      kid: { name: 'Kids', color: '#33b679' },
      school: { name: 'School', color: '#8e24aa' },
      home: { name: 'Home', color: '#e4a700' },
    };
    const today0 = () => startOfDay(new Date());
    function timed(id, day, h, m, mins, title, cal, loc) {
      const s = addDays(today0(), day); s.setHours(h, m, 0, 0);
      const c = cal === 'kid' ? { name: S.childName || 'Kids', color: CALS.kid.color } : CALS[cal];
      return { id: id, calId: cal, title: title, start: s.toISOString(), end: new Date(s.getTime() + mins * 6e4).toISOString(), allDay: false, location: loc || '', calendar: c.name, color: c.color };
    }
    function allDay(id, day, days, title, cal) {
      const s = addDays(today0(), day);
      return { id: id, calId: cal, title: title, start: ymd(s), end: ymd(addDays(s, days)), allDay: true, location: '', calendar: CALS[cal].name, color: CALS[cal].color };
    }
    const shown = (e) => !Array.isArray(S.calendarIds) || S.calendarIds.indexOf(e.calId) >= 0;
    function events() {
      const kid = S.childName || 'kids';
      return [
        timed('e1', 0, 7, 0, 30, 'Morning run', 'family'),
        timed('e2', 0, 10, 30, 60, 'Brunch with the Parkers', 'family', 'Corner Café'),
        timed('e3', 0, 15, 30, 45, 'Dentist — ' + kid, 'kid', 'Bright Smiles Dental'),
        timed('e4', 0, 18, 0, 90, 'Soccer practice', 'kid', 'Community field'),
        allDay('e5', 1, 1, 'Pizza day', 'school'),
        timed('e6', 1, 9, 0, 60, 'Team planning', 'work'),
        timed('e7', 1, 16, 30, 45, 'Piano lesson', 'kid'),
        allDay('e8', 2, 1, 'Garbage & recycling', 'home'),
        timed('e9', 2, 12, 0, 60, 'Lunch with Sam', 'work'),
        timed('e10', 2, 19, 0, 120, 'Book club', 'family'),
        allDay('e11', 3, 2, 'Grandma visiting', 'family'),
        timed('e12', 3, 11, 45, 15, 'Early dismissal', 'school'),
        timed('e13', 4, 19, 30, 150, 'Date night', 'family'),
        timed('e14', 5, 9, 0, 60, 'Swim lessons', 'kid', 'Aquatic centre'),
        timed('e15', 6, 14, 0, 120, 'Birthday party — Maya', 'kid'),
      ];
    }
    function tasks() {
      const d = (n) => ymd(addDays(today0(), n));
      return [
        { id: 't1', listId: 'l1', list: 'My Tasks', title: 'Renew car registration', due: d(-1) },
        { id: 't2', listId: 'l1', list: 'My Tasks', title: 'Call the plumber about the sink', due: d(0) },
        { id: 't3', listId: 'l2', list: 'Family', title: 'Sign field-trip permission form', due: d(1) },
        { id: 't4', listId: 'l2', list: 'Family', title: 'Return library books', due: d(3) },
        { id: 't5', listId: 'l1', list: 'My Tasks', title: 'Book flights for the holidays', due: null },
        { id: 't6', listId: 'l1', list: 'My Tasks', title: 'Change furnace filter', due: null },
      ];
    }
    function state() {
      let st = load('hd.demo', null);
      if (!st || st.v !== 1) {
        const mon = defaultWeekStart();
        const lunches = {};
        ['Pizza', 'Home lunch', 'Chicken wrap', 'Pasta & meatballs', 'Sub day'].forEach((v, i) => { lunches[ymd(addDays(mon, i))] = v; });
        st = {
          v: 1, seq: 100, done: [], lunches: lunches,
          groceries: ['Milk', 'Eggs', 'Bananas', 'Sourdough bread', 'Coffee beans', 'Chicken thighs', 'Baby spinach', 'Cheddar']
            .map((t, i) => ({ id: 'g' + (i + 1), title: t })),
        };
        save('hd.demo', st);
      }
      return st;
    }
    const taskPayload = (st) => ({ lists: ['My Tasks', 'Family'], items: tasks().filter((t) => st.done.indexOf(t.id) < 0) });
    return {
      loadAll() {
        const st = state();
        return { calendar: { events: events().filter(shown) }, tasks: taskPayload(st), groceries: st.groceries.slice(), lunches: Object.assign({}, st.lunches), errors: {} };
      },
      calendars() {
        return Object.keys(CALS).map((k) => ({
          id: k, name: k === 'kid' ? (S.childName || CALS.kid.name) : CALS[k].name, color: CALS[k].color, shownByDefault: true,
        }));
      },
      completeTask(t) { const st = state(); st.done.push(t.id); save('hd.demo', st); return { tasks: taskPayload(st) }; },
      addGroceries(items) {
        const st = state();
        items.slice().reverse().forEach((title) => st.groceries.unshift({ id: 'g' + (++st.seq), title: title }));
        save('hd.demo', st);
        return { groceries: st.groceries.slice() };
      },
      checkGrocery(id) {
        const st = state();
        st.groceries = st.groceries.filter((g) => g.id !== id);
        save('hd.demo', st);
        return { groceries: st.groceries.slice() };
      },
      setLunches(map) {
        const st = state();
        Object.keys(map).forEach((k) => { if (map[k]) st.lunches[k] = map[k]; else delete st.lunches[k]; });
        save('hd.demo', st);
        return { lunches: Object.assign({}, st.lunches) };
      },
      weather() {
        const f = S.units === 'F';
        const T = (c) => f ? c * 9 / 5 + 32 : c;
        const h = new Date().getHours();
        const days = [[2, 6, -1, 10], [61, 8, 3, 80], [3, 5, 0, 20], [71, 1, -4, 70], [0, 2, -6, 0], [1, 4, -3, 5], [80, 7, 1, 55]];
        return {
          sample: true,
          units: S.units,
          current: { temp: T(4), feels: T(1), code: 2, isDay: h >= 7 && h < 17, wind: f ? 9 : 14 },
          daily: days.map((d, i) => ({ date: addDays(today0(), i), code: d[0], max: T(d[1]), min: T(d[2]), pp: d[3] })),
          hourly: [],
        };
      },
    };
  })();

  /* ──────────────────────────── time formatting ──────────────────────────── */

  function fmtTime(d) {
    const h = d.getHours(), m = pad(d.getMinutes());
    if (S.clock24) return { t: pad(h) + ':' + m, ap: '' };
    return { t: (h % 12 || 12) + ':' + m, ap: h < 12 ? 'AM' : 'PM' };
  }
  const fmtTimeStr = (d) => { const f = fmtTime(d); return f.t + (f.ap ? ' ' + f.ap : ''); };
  function fmtHour(d) {
    const h = d.getHours();
    return S.clock24 ? pad(h) + ':00' : (h % 12 || 12) + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  /* ──────────────────────────── toast ──────────────────────────── */

  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 3200);
  }

  /* ──────────────────────────── clock & status ──────────────────────────── */

  function renderClock() {
    const now = new Date();
    const f = fmtTime(now);
    const timeHTML = esc(f.t) + (f.ap ? '<span class="ampm">' + f.ap + '</span>' : '');
    const dateText = DOW_LONG[now.getDay()] + ', ' + MON_LONG[now.getMonth()] + ' ' + now.getDate();
    setHTML($('#time'), timeHTML);
    setHTML($('#date'), esc(dateText));
    setHTML($('#nightTime'), timeHTML);
    setHTML($('#nightDate'), esc(dateText));
  }

  function renderStatus() {
    const b = $('#status');
    let html;
    if (isDemo()) html = '<i class="dot demo"></i>Demo';
    else if (sync.state === 'loading' && !sync.at) html = '<i class="dot busy"></i>Sync…';
    else if (sync.state === 'error') html = '<i class="dot bad"></i>Offline';
    else if (sync.at) html = '<i class="dot ' + (sync.state === 'warn' ? 'warn' : sync.state === 'loading' ? 'busy' : 'ok') + '"></i>' + esc(fmtTime(sync.at).t);
    else html = '<i class="dot"></i>…';
    setHTML(b, html);
    b.setAttribute('aria-label', isDemo() ? 'Demo data — open settings to connect Google' : 'Last updated — tap to refresh');
    b.title = isDemo() ? 'Showing demo data. Tap to connect Google.' : (sync.at ? 'Updated ' + fmtTimeStr(sync.at) : '');
  }

  /* ──────────────────────────── data refresh ──────────────────────────── */

  let refreshing = null;
  let lastRefresh = 0;

  function applyData(res) {
    const errors = Object.assign({}, res.errors || {});
    if (res.calendar) {
      data.events = res.calendar.events || [];
      if (res.calendar.errors && res.calendar.errors.length) errors.calendar = res.calendar.errors.join(' · ');
    }
    if (res.tasks) { data.tasks = res.tasks.items || []; data.taskLists = res.tasks.lists || []; }
    if (res.groceries) data.groceries = res.groceries;
    if (res.lunches) data.lunches = res.lunches;
    data.errors = errors;
    data.loaded = true;
  }

  function refreshData() {
    if (refreshing) return refreshing;
    sync.state = 'loading';
    renderStatus();
    const wasDemo = isDemo();
    refreshing = Backend.loadAll()
      .then((res) => {
        applyData(res);
        const errs = Object.keys(data.errors);
        sync = { state: errs.length ? 'warn' : 'ok', at: new Date(), msg: errs.map((k) => k + ': ' + data.errors[k]).join('\n') };
        if (!wasDemo) {
          const keep = Object.assign({}, data); delete keep.errors;
          save('hd.cache', { apiUrl: S.apiUrl, data: keep });
        }
      })
      .catch((err) => {
        sync.state = 'error';
        sync.msg = err.message;
        if (!data.loaded) data.errors = { calendar: err.message };
        console.warn('Refresh failed:', err);
      })
      .then(() => {
        refreshing = null;
        lastRefresh = Date.now();
        renderAll();
      });
    return refreshing;
  }

  /* ──────────────────────────── weather ──────────────────────────── */

  const WMO = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm & hail', 99: 'Thunderstorm & hail',
  };
  function wxKind(code) {
    if (code === 0) return 'clear';
    if (code === 1 || code === 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    if (code >= 51) return 'rain';
    return 'cloudy';
  }
  const CLOUD = 'M6.5 19A4.5 4.5 0 0 1 5.9 10.04 6 6 0 0 1 17.4 8.6 5.2 5.2 0 0 1 17.5 19Z';
  const SUN = '<path class="wx-ray" d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.35 5.35l1.55 1.55M17.1 17.1l1.55 1.55M5.35 18.65l1.55-1.55M17.1 6.9l1.55-1.55"/><circle class="wx-sun" cx="12" cy="12" r="4.4"/>';
  const MOON = '<path class="wx-moon" d="M20.5 13.3A8.6 8.6 0 1 1 10.7 3.5a6.7 6.7 0 0 0 9.8 9.8z"/>';
  function wxIcon(code, isDay) {
    const cloud = (tf, cls) => '<path class="wx-cloud' + (cls ? ' ' + cls : '') + '" d="' + CLOUD + '"' + (tf ? ' transform="' + tf + '"' : '') + '/>';
    const high = 'translate(1.2 -1.6) scale(.9)';
    let inner;
    switch (wxKind(code)) {
      case 'clear': inner = isDay ? SUN : MOON; break;
      case 'partly': inner = '<g transform="translate(-1.4 -2.4) scale(.74)">' + (isDay ? SUN : MOON) + '</g>' + cloud('translate(3.4 3.2) scale(.84)', 'edge'); break;
      case 'cloudy': inner = cloud('translate(5.2 -1.2) scale(.75)', 'back') + cloud('translate(-.6 3) scale(.86)', 'edge'); break;
      case 'fog': inner = cloud('translate(1.2 -2.8) scale(.9)') + '<path class="wx-fog" d="M4 18.6h16M6.5 21.8h11"/>'; break;
      case 'snow': inner = cloud(high) + '<g class="wx-flake"><circle cx="7.6" cy="18.8" r="1.2"/><circle cx="12" cy="21" r="1.2"/><circle cx="16.4" cy="18.8" r="1.2"/></g>'; break;
      case 'storm': inner = cloud(high) + '<path class="wx-bolt" d="M12.9 13.4l-3.7 5.3h2.9l-1.3 4.4 4.7-6.1h-3z"/>'; break;
      default: inner = cloud(high) + '<path class="wx-drop" d="M8.2 17.7l-1.2 3.4M12.2 17.7l-1.2 3.4M16.2 17.7l-1.2 3.4"/>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  }

  function normalizeWeather(j, units) {
    const c = j.current, d = j.daily, h = j.hourly;
    return {
      units: units,
      current: { temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, isDay: !!c.is_day, wind: c.wind_speed_10m },
      daily: d.time.map((t, i) => ({
        date: parseYmd(t), code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
        pp: d.precipitation_probability_max[i], sunrise: parseLocal(d.sunrise[i]), sunset: parseLocal(d.sunset[i]),
      })),
      hourly: h.time.map((t, i) => ({ time: parseLocal(t), pp: h.precipitation_probability[i], code: h.weather_code[i] })),
    };
  }

  function refreshWeather() {
    if (S.lat == null || S.lon == null) {
      weather = Demo.weather();
      weather.at = Date.now();
      weatherErr = '';
      renderWeather();
      return Promise.resolve();
    }
    const units = S.units;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + S.lat + '&longitude=' + S.lon +
      '&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m' +
      '&hourly=precipitation_probability,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
      '&timezone=auto&forecast_days=7' +
      (units === 'F' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '&wind_speed_unit=kmh');
    return fetchJSON(url, null, 15000)
      .then((j) => {
        weather = normalizeWeather(j, units);
        weather.at = Date.now();
        weatherErr = '';
        save('hd.weather', { raw: j, units: units, lat: S.lat, lon: S.lon, at: weather.at });
      })
      .catch((err) => { weatherErr = 'Weather unavailable (' + err.message + ')'; console.warn(err); })
      .then(renderWeather);
  }

  function loadCachedWeather() {
    const c = load('hd.weather', null);
    if (!c || c.lat !== S.lat || c.lon !== S.lon || c.units !== S.units || Date.now() - c.at > 6 * 36e5) return null;
    try { const w = normalizeWeather(c.raw, c.units); w.at = c.at; return w; } catch (e) { return null; }
  }

  function precipNote(w) {
    const now = Date.now();
    const next = w.hourly.filter((h) => h.time.getTime() > now - 36e5).slice(0, 12);
    for (let i = 0; i < next.length; i++) {
      if (next[i].pp >= 50) {
        const k = wxKind(next[i].code);
        const what = k === 'snow' ? 'Snow' : k === 'storm' ? 'Storms' : 'Rain';
        return i === 0 ? what + ' likely now' : what + ' likely around ' + fmtHour(next[i].time);
      }
    }
    return '';
  }

  function renderWeather() {
    const el = $('#weather');
    const w = weather;
    if (!w) {
      setHTML(el, '<div class="wx-empty">' + esc(weatherErr || 'Loading weather…') + '</div>');
      return;
    }
    const c = w.current;
    const d0 = w.daily[0] || {};
    const r = Math.round;
    const now = new Date();
    let line2 = 'H <b>' + r(d0.max) + '°</b> · L <b>' + r(d0.min) + '°</b> · Feels ' + r(c.feels) + '°';
    let line3, alert = false;
    if (w.sample) {
      line3 = 'Sample — set your city in Settings';
    } else {
      const note = precipNote(w);
      if (note) { line3 = note; alert = true; }
      else {
        line3 = 'Wind ' + r(c.wind) + ' ' + (w.units === 'F' ? 'mph' : 'km/h');
        const d1 = w.daily[1];
        if (d0.sunrise && now < d0.sunrise) line3 += ' · Sunrise ' + fmtTimeStr(d0.sunrise);
        else if (d0.sunset && now < d0.sunset) line3 += ' · Sunset ' + fmtTimeStr(d0.sunset);
        else if (d1 && d1.sunrise) line3 += ' · Sunrise ' + fmtTimeStr(d1.sunrise);
      }
    }
    if (weatherErr) { line3 = weatherErr; alert = true; }
    const place = S.place ? '<span class="wx-place">' + esc(S.place.split(',')[0]) + '</span>' : '';
    const days = w.daily.slice(1, 7).map((d) =>
      '<div class="wx-day">' +
        '<div class="wx-dow">' + DOW[d.date.getDay()] + '</div>' +
        '<div class="wx-icon">' + wxIcon(d.code, true) + '</div>' +
        '<div class="wx-hl"><b>' + r(d.max) + '°</b><span>' + r(d.min) + '°</span></div>' +
        '<div class="wx-pp">' + (d.pp >= 20 ? d.pp + '%' : '') + '</div>' +
      '</div>').join('');
    setHTML(el,
      '<div class="wx-now">' +
        '<div class="wx-icon">' + wxIcon(c.code, c.isDay) + '</div>' +
        '<div class="wx-temp">' + r(c.temp) + '°</div>' +
        '<div class="wx-text">' +
          '<div class="wx-desc">' + esc(WMO[c.code] || '') + place + '</div>' +
          '<div class="wx-sub">' + line2 + '</div>' +
          '<div class="wx-sub' + (alert ? ' alert' : '') + '">' + esc(line3) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="wx-days">' + days + '</div>');
    fitForecast();
  }

  // Show as many forecast days as fit (narrow iPads get fewer).
  function fitForecast() {
    const box = $('#weather .wx-days');
    if (!box) return;
    const tiles = $$('.wx-day', box);
    box.style.display = '';
    tiles.forEach((t) => { t.style.display = ''; });
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 17;
    const n = Math.min(tiles.length, Math.floor((box.clientWidth + .2 * rem) / (3.6 * rem)));
    if (n < 1) { box.style.display = 'none'; return; }
    tiles.forEach((t, i) => { t.style.display = i < n ? '' : 'none'; });
  }

  /* ──────────────────────────── calendar ──────────────────────────── */

  function evRange(ev) {
    if (ev.allDay) {
      const s = parseYmd(ev.start);
      let e = parseYmd(ev.end || ev.start);
      if (e <= s) e = addDays(s, 1);
      return { s: s, e: e };
    }
    const s = new Date(ev.start);
    let e = new Date(ev.end || ev.start);
    if (!(e > s)) e = new Date(s.getTime() + 1);
    return { s: s, e: e };
  }

  function renderCalendar() {
    const now = new Date();
    const today = startOfDay(now);
    const n = S.calendarDays;
    $('#calMeta').textContent = 'Next ' + n + ' days';
    if (Array.isArray(S.calendarIds) && !S.calendarIds.length) {
      setHTML($('#calBody'), '<div class="empty">No calendars selected. Tick some in Settings → Calendars.</div>');
      return;
    }

    const days = [];
    for (let i = 0; i < n; i++) days.push({ date: addDays(today, i), items: [] });
    (data.events || []).forEach((ev) => {
      const r = evRange(ev);
      days.forEach((day) => {
        const ds = day.date, de = addDays(ds, 1);
        if (r.s < de && r.e > ds) day.items.push({ ev: ev, r: r, cont: r.s < ds });
      });
    });

    let html = data.errors.calendar ? cardError(data.errors.calendar) : '';
    let any = false;
    days.forEach((day, i) => {
      if (!day.items.length && i > 0) return;
      any = any || day.items.length > 0;
      day.items.sort((a, b) =>
        (b.ev.allDay - a.ev.allDay) || ((a.cont ? 0 : 1) - (b.cont ? 0 : 1)) || (a.r.s - b.r.s) || String(a.ev.title).localeCompare(b.ev.title));
      const d = day.date;
      const rel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DOW_LONG[d.getDay()];
      const abs = (i < 2 ? DOW[d.getDay()] + ', ' : '') + MON[d.getMonth()] + ' ' + d.getDate();
      html += '<div class="day' + (i === 0 ? ' is-today' : '') + '">' +
        '<div class="day-head"><span class="rel">' + rel + '</span><span class="abs">' + abs + '</span></div>';
      if (!day.items.length) html += '<div class="ev-empty">Nothing scheduled</div>';
      day.items.forEach((it) => { html += eventHTML(it, day.date, now); });
      html += '</div>';
    });
    if (!any && data.loaded) html += '<div class="empty">No other events in the next ' + n + ' days.</div>';
    setHTML($('#calBody'), html);
  }

  function eventHTML(it, dayDate, now) {
    const ev = it.ev, r = it.r;
    const past = r.e <= now;
    const live = !ev.allDay && r.s <= now && r.e > now;
    let time;
    if (ev.allDay) time = '<span class="ev-time all">All day</span>';
    else if (it.cont) time = '<span class="ev-time all">Cont.</span>';
    else {
      const f = fmtTime(r.s);
      time = '<span class="ev-time">' + f.t + (f.ap ? '<small>' + f.ap + '</small>' : '') + '</span>';
    }
    const sub = [];
    if (!ev.allDay) {
      const endsOther = ymd(r.e) !== ymd(dayDate) && !(r.e.getHours() === 0 && r.e.getMinutes() === 0 && ymd(addDays(r.e, -1)) === ymd(dayDate));
      sub.push('until ' + (endsOther ? DOW[r.e.getDay()] + ' ' : '') + fmtTimeStr(r.e));
    } else if (r.e - r.s > DAY) {
      sub.push('through ' + DOW[addDays(r.e, -1).getDay()]);
    }
    if (ev.calendar) sub.push(ev.calendar);
    if (ev.location) sub.push(ev.location.split('\n')[0]);
    return '<div class="ev' + (past ? ' past' : '') + (live ? ' live' : '') + '" style="--c:' + safeColor(ev.color) + '">' +
      time +
      '<div class="ev-main">' +
        '<div class="ev-title">' + (live ? '<span class="now-tag">Now</span>' : '') + esc(ev.title) + '</div>' +
        (sub.length ? '<div class="ev-sub">' + esc(sub.join(' · ')) + '</div>' : '') +
      '</div></div>';
  }

  const cardError = (msg) => '<div class="card-error">' + icon('alert') + '<span>' + esc(msg) + '</span></div>';

  /* ──────────────────────────── tasks ──────────────────────────── */

  const pending = { t: {}, g: {} }; // items checked off but not yet sent (tap again to undo)

  function dueInfo(due) {
    if (!due) return null;
    const d = parseYmd(due);
    const diff = Math.round((d - startOfDay(new Date())) / DAY);
    if (diff < 0) return { cls: 'overdue', label: diff === -1 ? 'Yesterday' : 'Overdue · ' + MON[d.getMonth()] + ' ' + d.getDate() };
    if (diff === 0) return { cls: 'today', label: 'Today' };
    if (diff === 1) return { cls: '', label: 'Tomorrow' };
    if (diff < 7) return { cls: '', label: DOW_LONG[d.getDay()] };
    return { cls: '', label: MON[d.getMonth()] + ' ' + d.getDate() };
  }

  function renderTasks() {
    const items = (data.tasks || []).slice().sort((a, b) => {
      if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });
    const multi = (data.taskLists || []).length > 1;
    $('#tasksMeta').textContent = items.length ? items.length + ' open' : '';
    let html = data.errors.tasks ? cardError(data.errors.tasks) : '';
    if (!items.length) html += data.loaded ? '<div class="empty">All caught up.</div>' : '';
    else {
      html += '<ul class="list">' + items.map((t) => {
        const di = dueInfo(t.due);
        const sub = [];
        if (di) sub.push('<span class="due">' + esc(di.label) + '</span>');
        if (multi && t.list) sub.push(esc(t.list));
        return '<li class="task' + (di && di.cls ? ' ' + di.cls : '') + (pending.t[t.id] ? ' done' : '') + '" data-tid="' + esc(t.id) + '">' +
          '<span class="check">' + icon('tick') + '</span>' +
          '<span class="task-main"><span class="task-title">' + esc(t.title) + '</span>' +
          (sub.length ? '<span class="task-sub">' + sub.join(' · ') + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    setHTML($('#tasksBody'), html);
  }

  function toggleDone(kind, id, commit, render) {
    const bag = pending[kind];
    if (bag[id]) { clearTimeout(bag[id]); delete bag[id]; render(); return; }
    bag[id] = setTimeout(() => { delete bag[id]; commit(); }, 2500);
    render();
  }

  function onTaskTap(id) {
    const t = (data.tasks || []).filter((x) => x.id === id)[0];
    if (!t) return;
    toggleDone('t', id, () => {
      data.tasks = data.tasks.filter((x) => x.id !== id);
      renderTasks();
      Backend.completeTask(t)
        .then((res) => { if (res && res.tasks) { data.tasks = res.tasks.items || []; data.taskLists = res.tasks.lists || []; renderTasks(); } })
        .catch((err) => { data.tasks.push(t); renderTasks(); toast('Couldn’t complete task — ' + err.message, 5000); });
    }, renderTasks);
  }

  /* ──────────────────────────── groceries ──────────────────────────── */

  const KEEP_TOGETHER = /\b(mac(?:aroni)? and cheese|half and half|salt and pepper|sour cream and onion|pork and beans|fish and chips|peanut butter and jelly|chips and salsa)\b/gi;

  // "add milk, eggs and bread to the grocery list" → ["Milk", "Eggs", "Bread"]
  function parseItems(text, voice) {
    let t = String(text || '').trim();
    if (!t) return [];
    t = t.replace(/^(?:please\s+)?(?:add|put|get)\s+/i, '')
      .replace(/\s+(?:to|on)\s+(?:the\s+|my\s+|our\s+)?(?:grocery|groceries|shopping)(?:\s+list)?[\s.!]*$/i, '');
    t = t.replace(KEEP_TOGETHER, (m) => m.replace(/ and /gi, ' \u0001 '));
    const splitter = voice ? /\s*(?:,|;|\n|\band\b|&|\bplus\b)\s*/i : /\s*(?:,|;|\n)\s*/;
    return t.split(splitter)
      .map((s) => s.replace(/\u0001/g, 'and').replace(/[.!?]+$/, '').trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .slice(0, 30);
  }

  function renderGroceries() {
    const items = data.groceries || [];
    $('#groceryMeta').textContent = items.length ? items.length + (items.length === 1 ? ' item' : ' items') : '';
    let html = data.errors.groceries ? cardError(data.errors.groceries) : '';
    if (!items.length) html += data.loaded ? '<div class="empty">The list is empty. Type or tap the mic to add something.</div>' : '';
    else {
      html += '<ul class="g-list">' + items.map((g) =>
        '<li class="g-item' + (pending.g[g.id] ? ' checked' : '') + (g.saving ? ' saving' : '') + '" data-gid="' + esc(g.id) + '">' +
          '<span class="check">' + icon('tick') + '</span><span class="g-name">' + esc(g.title) + '</span></li>').join('') + '</ul>';
    }
    setHTML($('#groceryBody'), html);
  }

  function addGroceryText(text, voice) {
    const items = parseItems(text, voice);
    if (!items.length) return;
    const have = {};
    (data.groceries || []).forEach((g) => { have[g.title.toLowerCase()] = 1; });
    const fresh = [], dupes = [];
    items.forEach((i) => {
      const k = i.toLowerCase();
      if (have[k]) dupes.push(i); else { have[k] = 1; fresh.push(i); }
    });
    if (dupes.length) toast(listJoin(dupes) + (dupes.length > 1 ? ' are' : ' is') + ' already on the list');
    if (!fresh.length) return;

    const temps = fresh.map((t, i) => ({ id: 'tmp' + Date.now() + '-' + i, title: t, saving: true }));
    data.groceries = temps.concat(data.groceries || []);
    renderGroceries();
    Backend.addGroceries(fresh)
      .then((res) => {
        if (res && res.groceries) data.groceries = res.groceries;
        else data.groceries = data.groceries.map((g) => (temps.indexOf(g) >= 0 ? { id: g.id, title: g.title } : g));
        renderGroceries();
        if (!dupes.length) toast('Added ' + listJoin(fresh));
      })
      .catch((err) => {
        data.groceries = data.groceries.filter((g) => temps.indexOf(g) < 0);
        renderGroceries();
        toast('Couldn’t add — ' + err.message, 5000);
      });
  }

  function onGroceryTap(id) {
    if (id.indexOf('tmp') === 0) return;
    const g = (data.groceries || []).filter((x) => x.id === id)[0];
    if (!g) return;
    toggleDone('g', id, () => {
      data.groceries = data.groceries.filter((x) => x.id !== id);
      renderGroceries();
      Backend.checkGrocery(id)
        .then((res) => { if (res && res.groceries) { data.groceries = res.groceries; renderGroceries(); } })
        .catch((err) => { data.groceries.push(g); renderGroceries(); toast('Couldn’t update — ' + err.message, 5000); });
    }, renderGroceries);
  }

  /* ──────────────────────────── voice input ──────────────────────────── */

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRec = null;

  function dictate(input, btn, onDone) {
    if (activeRec) { activeRec.stop(); return; }
    if (!SpeechRec || !window.isSecureContext) {
      input.focus();
      toast('Tap the microphone on the keyboard to dictate', 4000);
      return;
    }
    let heard = '';
    const rec = new SpeechRec();
    rec.lang = LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      heard = t;
      input.value = t;
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Microphone not allowed here — use the mic on the keyboard instead', 5000);
      else if (e.error === 'no-speech') toast('Didn’t catch that — try again');
      else if (e.error !== 'aborted') toast('Voice input error (' + e.error + ')');
    };
    rec.onend = () => {
      activeRec = null;
      btn.classList.remove('listening');
      if (heard.trim()) onDone(heard.trim());
    };
    try {
      rec.start();
      activeRec = rec;
      btn.classList.add('listening');
      toast('Listening…', 1800);
    } catch (err) {
      activeRec = null;
      input.focus();
      toast('Voice input unavailable — use the mic on the keyboard', 4000);
    }
  }

  /* ──────────────────────────── lunches ──────────────────────────── */

  let lunchOffset = 0;
  let lunchNavAt = 0;

  function mondayOf(d) {
    const x = startOfDay(d), dow = x.getDay();
    return addDays(x, dow === 0 ? -6 : 1 - dow);
  }
  // Mon–Fri shows this week; on the weekend, jump to the coming week.
  function defaultWeekStart() {
    const t = startOfDay(new Date()), dow = t.getDay();
    return dow === 0 || dow === 6 ? addDays(mondayOf(t), 7) : mondayOf(t);
  }
  const lunchWeekStart = () => addDays(defaultWeekStart(), lunchOffset * 7);

  function weekLabel(mon) {
    const diff = Math.round((mon - mondayOf(new Date())) / (7 * DAY));
    if (diff === 0) return 'This week';
    if (diff === 1) return 'Next week';
    if (diff === -1) return 'Last week';
    return 'Week of ' + MON[mon.getMonth()] + ' ' + mon.getDate();
  }
  function rangeLabel(mon) {
    const fri = addDays(mon, 4);
    return MON[mon.getMonth()] + ' ' + mon.getDate() + ' – ' + (fri.getMonth() !== mon.getMonth() ? MON[fri.getMonth()] + ' ' : '') + fri.getDate();
  }
  const lunchTitle = () => { const n = (S.childName || '').trim(); return n ? n + '’s lunches' : 'School lunches'; };

  function renderLunch() {
    $('#lunchTitle').textContent = lunchTitle();
    const mon = lunchWeekStart();
    const today = ymd(new Date());
    setHTML($('#lunchWeek'), '<b>' + weekLabel(mon) + '</b> · ' + rangeLabel(mon));
    let html = data.errors.lunches ? cardError(data.errors.lunches) : '';
    html += '<ul class="ld-list">';
    for (let i = 0; i < 5; i++) {
      const d = addDays(mon, i), k = ymd(d), v = (data.lunches || {})[k];
      html += '<li class="ld' + (k === today ? ' is-today' : '') + (k < today ? ' past' : '') + '" data-date="' + k + '">' +
        '<span class="ld-day"><span class="ld-dow">' + DOW[d.getDay()] + '</span><span class="ld-num">' + d.getDate() + '</span></span>' +
        '<span class="ld-order' + (v ? '' : ' empty') + '">' + esc(v || 'Tap to add') + '</span></li>';
    }
    setHTML($('#lunchBody'), html + '</ul>');
  }

  function lunchSuggestions() {
    const counts = {};
    Object.keys(data.lunches || {}).forEach((k) => {
      const v = data.lunches[k];
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    const list = Object.keys(counts).sort((a, b) => (counts[b] - counts[a]) || a.localeCompare(b)).slice(0, 10);
    ['Home lunch', 'No school'].forEach((s) => { if (list.indexOf(s) < 0) list.push(s); });
    return list;
  }

  function openLunchEditor(focusDate) {
    const mon = lunchWeekStart();
    let rows = '';
    for (let i = 0; i < 5; i++) {
      const d = addDays(mon, i), k = ymd(d);
      rows += '<label class="le-row" data-row="' + k + '">' +
        '<span class="le-day">' + DOW_LONG[d.getDay()] + '<small>' + MON[d.getMonth()] + ' ' + d.getDate() + '</small></span>' +
        '<input type="text" data-date="' + k + '" value="' + esc((data.lunches || {})[k] || '') + '" placeholder="—" maxlength="120" autocomplete="off"></label>';
    }
    const chips = lunchSuggestions().map((s) => '<button type="button" class="chip" data-chip="' + esc(s) + '">' + esc(s) + '</button>').join('');
    const m = openModal(
      '<div class="modal-head"><h2>' + esc(lunchTitle()) + '</h2><span class="modal-sub">' + weekLabel(mon) + ' · ' + rangeLabel(mon) + '</span>' +
      '<button class="icon-btn" type="button" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      '<div class="le-rows">' + rows + '</div>' +
      '<div class="chips-label">Quick picks — tap a day, then a pick</div><div class="chips">' + chips + '</div>' +
      '<div class="modal-foot"><button class="btn" type="button" data-clear>Clear week</button><span class="grow"></span>' +
      '<button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" data-save>Save</button></div>');

    const inputs = $$('input[data-date]', m);
    let sel = null;
    const select = (inp) => {
      sel = inp;
      $$('.le-row', m).forEach((r) => r.classList.toggle('sel', !!inp && r.getAttribute('data-row') === inp.getAttribute('data-date')));
    };
    inputs.forEach((inp, i) => {
      inp.addEventListener('focus', () => select(inp));
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); else inp.blur(); }
      });
    });
    select(inputs.filter((x) => x.getAttribute('data-date') === focusDate)[0] || inputs.filter((x) => !x.value)[0] || inputs[0]);

    m.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chip]');
      if (chip) {
        const target = sel || inputs[0];
        target.value = chip.getAttribute('data-chip');
        const idx = inputs.indexOf(target);
        select(inputs.slice(idx + 1).filter((x) => !x.value)[0] || inputs[idx + 1] || target);
        return;
      }
      if (e.target.closest('[data-clear]')) { inputs.forEach((x) => { x.value = ''; }); select(inputs[0]); return; }
      if (e.target.closest('[data-save]')) {
        const map = {};
        inputs.forEach((x) => { map[x.getAttribute('data-date')] = x.value.trim(); });
        closeModal();
        saveLunches(map);
      }
    });
  }

  function saveLunches(map) {
    const before = Object.assign({}, data.lunches);
    Object.keys(map).forEach((k) => { if (map[k]) data.lunches[k] = map[k]; else delete data.lunches[k]; });
    renderLunch();
    Backend.setLunches(map)
      .then((res) => { if (res && res.lunches) { data.lunches = res.lunches; renderLunch(); } toast('Lunches saved'); })
      .catch((err) => { data.lunches = before; renderLunch(); toast('Couldn’t save lunches — ' + err.message, 5000); });
  }

  /* ──────────────────────────── front-door camera ──────────────────────────── */

  let camPlaying = false;
  let camStopTimer = null;
  let camTimers = [];
  const isStreamMode = () => S.camMode === 'mjpeg' || S.camMode === 'hls' || S.camMode === 'iframe';
  const camBust = (url) => url + (url.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();

  function camMediaHTML() {
    const u = esc(S.camUrl);
    switch (S.camMode) {
      case 'snapshot': return '<img class="cam-media" data-snap src="' + esc(camBust(S.camUrl)) + '" alt="Front door snapshot">';
      case 'mjpeg': return '<img class="cam-media" src="' + u + '" alt="Front door live view"><span class="cam-live">LIVE</span>';
      case 'hls': return '<video class="cam-media" src="' + u + '" autoplay muted playsinline></video><span class="cam-live">LIVE</span>';
      case 'iframe': return '<iframe class="cam-media" src="' + u + '" allow="autoplay; fullscreen" referrerpolicy="no-referrer" title="Front door camera"></iframe>';
    }
    return '';
  }

  // Wire up error messages and snapshot refreshing inside a container.
  function mountCamMedia(box) {
    box.innerHTML = camMediaHTML();
    const media = $('.cam-media', box);
    if (media && media.tagName !== 'IFRAME') {
      media.addEventListener('error', () => {
        if ($('.cam-error', box)) return;
        const insecure = /^http:/i.test(S.camUrl) && location.protocol === 'https:';
        box.insertAdjacentHTML('beforeend', '<div class="cam-error"><b>Can’t load the camera</b><span>' +
          (insecure
            ? 'The camera address starts with http:// but this dashboard is on https://, so the iPad blocks it. See “Front door camera” in the README.'
            : 'Check the camera URL in Settings and that the camera server is running.') + '</span></div>');
      });
    }
    if (S.camMode === 'snapshot') {
      const t = setInterval(() => {
        const img = $('img[data-snap]', box);
        if (!img || document.hidden) return;
        const pre = new Image();
        pre.onload = () => { img.src = pre.src; const er = $('.cam-error', box); if (er) er.remove(); };
        pre.src = camBust(S.camUrl);
      }, Math.max(2, +S.camRefresh || 10) * 1000);
      camTimers.push(t);
      return t;
    }
    return null;
  }

  function renderCam() {
    camTimers.forEach(clearInterval);
    camTimers = [];
    const body = $('#camBody'), tools = $('#camTools');
    const appBtn = S.camLink
      ? '<a class="mini-btn" href="' + esc(S.camLink) + '" target="_blank" rel="noopener" aria-label="' + esc(S.camLinkLabel || 'Open camera app') + '">' + icon('external') + '</a>'
      : '';

    if (S.camMode === 'none' || (S.camMode !== 'link' && !S.camUrl)) {
      tools.innerHTML = appBtn;
      body.innerHTML = '<div class="cam-empty">' + icon('video', 'big') +
        '<div class="cam-empty-title">Camera not set up yet</div>' +
        '<div class="cam-empty-sub">Add your doorbell’s live stream, or a button that opens its app.</div>' +
        '<button class="btn small" type="button" data-act="settings-cam">Set up camera</button></div>';
      return;
    }
    if (S.camMode === 'link') {
      tools.innerHTML = '';
      body.innerHTML = '<a class="cam-launch" href="' + esc(S.camLink || '#') + '" target="_blank" rel="noopener">' +
        icon('video', 'big') + '<span>' + esc(S.camLinkLabel || 'Open camera') + '</span></a>';
      return;
    }
    tools.innerHTML = appBtn + '<button class="mini-btn" type="button" data-act="cam-full" aria-label="Full screen">' + icon('expand') + '</button>';
    if (isStreamMode() && S.camTapToPlay && !camPlaying) {
      body.innerHTML = '<button class="cam-poster" type="button" data-act="cam-play">' + icon('play', 'big') + '<span>Tap for live view</span></button>';
      return;
    }
    mountCamMedia(body);
  }

  function playCam() {
    camPlaying = true;
    renderCam();
    clearTimeout(camStopTimer);
    camStopTimer = setTimeout(() => { camPlaying = false; renderCam(); }, 3 * 60e3);
  }

  function openCamFull() {
    const m = openModal('<div class="cam-full" id="camFull"></div>' +
      '<button class="icon-btn cam-full-close" type="button" data-close aria-label="Close">' + icon('close') + '</button>',
      { cls: 'modal-cam', onClose: () => { if (t) clearInterval(t); } });
    const t = mountCamMedia($('#camFull', m));
  }

  /* ──────────────────────────── Ask AI ──────────────────────────── */

  function aiLinks() {
    return String(S.aiLinks || '').split('\n').map((line) => {
      const i = line.indexOf('|');
      if (i < 0) return null;
      const name = line.slice(0, i).trim(), url = line.slice(i + 1).trim();
      return name && /^https?:\/\//i.test(url) ? { name: name, url: url } : null;
    }).filter(Boolean);
  }
  function aiUrl(tpl, q) {
    if (tpl.indexOf('%s') < 0) return tpl;
    if (q) return tpl.replace('%s', encodeURIComponent(q));
    return tpl.replace(/[?&][^?&=#]+=%s/, '').replace('%s', '');
  }
  const AI_COLORS = { claude: '#d97757', chatgpt: '#10a37f', gemini: '#4f7cff', perplexity: '#1f8a95', copilot: '#2a6fdb', grok: '#3b3f47', meta: '#0866ff' };
  const PALETTE = ['#6c7bff', '#e0743f', '#2fa37a', '#c056c9', '#d9a52b', '#3a9bd9'];
  function aiColor(name) {
    const k = name.toLowerCase().replace(/[^a-z]/g, '');
    if (AI_COLORS[k]) return AI_COLORS[k];
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  const hostOf = (u) => { const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(u); return m ? m[1] : u; };

  function openAskAI() {
    const links = aiLinks();
    const m = openModal(
      '<div class="modal-head"><h2>Ask AI</h2><button class="icon-btn" type="button" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      '<form class="ask-row" data-ask><input type="text" id="askQ" placeholder="Type or say a question (optional)" autocomplete="off">' +
      '<button type="button" class="round-btn mic" id="askMic" aria-label="Speak your question">' + icon('mic') + '</button></form>' +
      '<div class="ai-grid">' + links.map((l, i) =>
        '<button type="button" class="ai-tile" data-ai="' + i + '">' +
          '<span class="ai-mono" style="background:' + aiColor(l.name) + '">' + esc(l.name.charAt(0).toUpperCase()) + '</span>' +
          '<span class="ai-name">' + esc(l.name) + '</span><span class="ai-host">' + esc(hostOf(l.url)) + '</span></button>').join('') +
      '</div>' +
      '<p class="hint">Opens the assistant in a new window. Where supported, your question is filled in for you. Change this list in Settings.</p>',
      { cls: 'modal-ai' });
    const q = $('#askQ', m);
    const go = (i) => { window.open(aiUrl(links[i].url, q.value.trim()), '_blank'); closeModal(); };
    $('#askMic', m).addEventListener('click', () => dictate(q, $('#askMic', m), () => {}));
    $('[data-ask]', m).addEventListener('submit', (e) => { e.preventDefault(); if (links.length) go(0); });
    m.addEventListener('click', (e) => { const t = e.target.closest('[data-ai]'); if (t) go(+t.getAttribute('data-ai')); });
  }

  /* ──────────────────────────── modal ──────────────────────────── */

  let modalOnClose = null;
  function openModal(html, opts) {
    opts = opts || {};
    if (modalOpen) closeModal();
    const m = $('#modal');
    m.className = 'modal' + (opts.cls ? ' ' + opts.cls : '');
    m.innerHTML = html;
    m.scrollTop = 0;
    $('#modalWrap').classList.add('open');
    modalOpen = true;
    modalOnClose = opts.onClose || null;
    $$('[data-close]', m).forEach((b) => b.addEventListener('click', closeModal));
    updateNight();
    return m;
  }
  function closeModal() {
    if (activeRec) activeRec.abort();
    $('#modalWrap').classList.remove('open');
    $('#modal').innerHTML = '';
    modalOpen = false;
    const f = modalOnClose;
    modalOnClose = null;
    if (f) f();
  }

  /* ──────────────────────────── settings modal ──────────────────────────── */

  function openSettings(section) {
    let place = { name: S.place, lat: S.lat, lon: S.lon };
    const opt = (v, list) => list.map((o) => '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
    const m = openModal(`
      <div class="modal-head"><h2>Settings</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="settings">
        <fieldset>
          <legend>Google — calendars, tasks, groceries, lunches</legend>
          <label class="field"><span>Apps Script web app URL</span>
            <input id="sApiUrl" type="url" value="${esc(S.apiUrl)}" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
          <label class="field"><span>Dashboard key (printed by setup() in Apps Script)</span>
            <input id="sApiKey" type="text" value="${esc(S.apiKey)}" placeholder="e.g. 3f9c1a…" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
          <div class="row"><button class="btn" type="button" id="sTest">Test connection</button><span class="test-out" id="sTestOut"></span></div>
          <p class="hint">Leave these blank to keep using demo data. Steps to create the web app are in <b>README.md</b>.</p>
        </fieldset>

        <fieldset id="sCalSection">
          <legend>Calendars</legend>
          <div class="cal-picks" id="sCals"><span class="hint">Loading your calendars…</span></div>
          <div class="row"><button class="btn small" type="button" id="sCalsReset">Match Google Calendar</button><span class="hint cal-note" id="sCalsNote"></span></div>
          <p class="hint">Unticked calendars are hidden on this dashboard only. They stay visible in Google Calendar.</p>
        </fieldset>

        <fieldset>
          <legend>Weather</legend>
          <div class="row"><input id="sPlaceQ" type="text" placeholder="Search for your town or city" autocomplete="off">
            <button class="btn" type="button" id="sPlaceGo">Search</button>
            <button class="btn" type="button" id="sGeo">${icon('pin')}Use this iPad’s location</button></div>
          <div class="place-results" id="sPlaces"></div>
          <p class="hint">Location: <b id="sPlaceNow">${esc(S.place || 'not set — showing sample weather')}</b></p>
          <label class="field"><span>Units</span><select id="sUnits">${opt(S.units, [['C', '°C and km/h'], ['F', '°F and mph']])}</select></label>
        </fieldset>

        <fieldset>
          <legend>Display</legend>
          <div class="grid3">
            <label class="field"><span>Clock</span><select id="sClock">${opt(S.clock24 ? '24' : '12', [['12', '12-hour'], ['24', '24-hour']])}</select></label>
            <label class="field"><span>Theme</span><select id="sTheme">${opt(S.theme, [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Match iPad']])}</select></label>
            <label class="field"><span>Calendar shows</span><select id="sDays">${opt(S.calendarDays, [[3, '3 days'], [5, '5 days'], [7, '7 days'], [10, '10 days'], [14, '14 days']])}</select></label>
          </div>
          <label class="check-field"><input type="checkbox" id="sNight" ${S.nightMode ? 'checked' : ''}> Night clock (dark screen with a dim clock; tap to wake)</label>
          <div class="grid2">
            <label class="field"><span>Night starts</span><input id="sNightStart" type="time" value="${esc(S.nightStart)}"></label>
            <label class="field"><span>Night ends</span><input id="sNightEnd" type="time" value="${esc(S.nightEnd)}"></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>School lunches</legend>
          <label class="field"><span>Child’s name</span><input id="sChild" type="text" value="${esc(S.childName)}" placeholder="e.g. Sam"></label>
        </fieldset>

        <fieldset id="sCamSection">
          <legend>Front door camera</legend>
          <label class="field"><span>What to show</span><select id="sCamMode">${opt(S.camMode, [
            ['none', 'Nothing yet'],
            ['link', 'A big button that opens the camera’s app or website'],
            ['snapshot', 'Snapshot image that refreshes'],
            ['mjpeg', 'Live MJPEG stream'],
            ['hls', 'Live HLS video (.m3u8)'],
            ['iframe', 'Live player web page (go2rtc, Scrypted, Home Assistant…)'],
          ])}</select></label>
          <label class="field"><span>Stream or image URL (must start with https://)</span>
            <input id="sCamUrl" type="url" value="${esc(S.camUrl)}" placeholder="https://…/api/stream.m3u8?src=front_door" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
          <div class="grid2">
            <label class="field"><span>Snapshot refresh (seconds)</span><input id="sCamRefresh" type="number" min="2" max="600" value="${esc(S.camRefresh)}"></label>
            <label class="field"><span>Button label</span><input id="sCamLinkLabel" type="text" value="${esc(S.camLinkLabel)}" placeholder="Open Ring"></label>
          </div>
          <label class="field"><span>App / website link (optional)</span>
            <input id="sCamLink" type="url" value="${esc(S.camLink)}" placeholder="https://account.ring.com/account/dashboard" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
          <label class="check-field"><input type="checkbox" id="sCamTap" ${S.camTapToPlay ? 'checked' : ''}> Only stream when tapped (saves a battery doorbell)</label>
        </fieldset>

        <fieldset>
          <legend>Ask AI buttons</legend>
          <label class="field"><span>One per line: Name | URL — put %s where the question should go</span>
            <textarea id="sAi" rows="4" autocapitalize="off" autocorrect="off" spellcheck="false">${esc(S.aiLinks)}</textarea></label>
        </fieldset>

        <fieldset>
          <legend>Move these settings to another device</legend>
          <p class="hint">Copy a link containing all of these settings (including your key — keep it private). On the iPad, paste it below, or open it in Safari before adding the dashboard to the Home Screen.</p>
          <div class="row"><button class="btn" type="button" id="sCopy">Copy setup link</button></div>
          <textarea id="sLinkOut" class="hidden" rows="3" readonly></textarea>
          <div class="row"><input id="sImport" type="text" placeholder="Paste a setup link here" autocapitalize="off" autocorrect="off" spellcheck="false">
            <button class="btn" type="button" id="sImportBtn">Import</button></div>
        </fieldset>
      </div>
      <div class="modal-foot"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="sSave">Save</button></div>
    `, { cls: 'modal-settings' });

    const val = (id) => $('#' + id, m).value.trim();

    // ── calendar checkboxes ──
    const token = {};
    m._settingsToken = token;
    let calChoice = Array.isArray(S.calendarIds) ? S.calendarIds.slice() : null; // null = follow Google Calendar's ticks
    let calList = null;
    function renderCalPicks() {
      const box = $('#sCals', m);
      if (!calList || !box) return;
      box.innerHTML = calList.length
        ? calList.map((c) => {
            const on = calChoice ? calChoice.indexOf(c.id) >= 0 : c.shownByDefault;
            return '<label class="cal-pick"><input type="checkbox" value="' + esc(c.id) + '"' + (on ? ' checked' : '') + '>' +
              '<span class="swatch" style="background:' + safeColor(c.color) + '"></span><span class="nm">' + esc(c.name) + '</span></label>';
          }).join('')
        : '<span class="hint">No calendars found in this Google account.</span>';
      $('#sCalsNote', m).textContent = calChoice ? '' : 'Showing the calendars ticked in Google Calendar.';
    }
    $('#sCals', m).addEventListener('change', () => {
      calChoice = $$('#sCals input', m).filter((i) => i.checked).map((i) => i.value);
      $('#sCalsNote', m).textContent = calChoice.length ? '' : 'Nothing ticked: the calendar card will be empty.';
    });
    $('#sCalsReset', m).addEventListener('click', () => { calChoice = null; renderCalPicks(); });
    Backend.listCalendars()
      .then((list) => { if (m._settingsToken !== token) return; calList = list; renderCalPicks(); })
      .catch((err) => {
        if (m._settingsToken !== token) return;
        $('#sCals', m).innerHTML = '<span class="hint">' + esc(/Unknown action/.test(err.message)
          ? 'To choose calendars here, update your Apps Script to the newest Code.gs and deploy a new version (see README).'
          : 'Couldn’t load your calendars: ' + err.message) + '</span>';
        $('#sCalsReset', m).classList.add('hidden');
      });

    function collect() {
      return Object.assign({}, S, {
        calendarIds: calChoice,
        apiUrl: val('sApiUrl'),
        apiKey: val('sApiKey'),
        place: place.name || '',
        lat: place.lat,
        lon: place.lon,
        units: val('sUnits'),
        clock24: val('sClock') === '24',
        theme: val('sTheme'),
        calendarDays: +val('sDays') || 7,
        childName: val('sChild'),
        nightMode: $('#sNight', m).checked,
        nightStart: val('sNightStart') || '22:00',
        nightEnd: val('sNightEnd') || '06:00',
        camMode: val('sCamMode'),
        camUrl: val('sCamUrl'),
        camRefresh: Math.max(2, +val('sCamRefresh') || 10),
        camLink: val('sCamLink'),
        camLinkLabel: val('sCamLinkLabel'),
        camTapToPlay: $('#sCamTap', m).checked,
        aiLinks: $('#sAi', m).value.trim() || DEFAULT_AI,
      });
    }

    $('#sTest', m).addEventListener('click', () => {
      const c = collect(), out = $('#sTestOut', m);
      out.className = 'test-out';
      if (!c.apiUrl) { out.textContent = 'Enter the web app URL first.'; return; }
      out.textContent = 'Testing…';
      api('ping', null, c)
        .then(() => { out.textContent = '✓ Connected'; out.className = 'test-out ok'; })
        .catch((e) => { out.textContent = '✗ ' + e.message; out.className = 'test-out bad'; });
    });

    function searchPlace() {
      const q = val('sPlaceQ');
      if (!q) return;
      const box = $('#sPlaces', m);
      box.innerHTML = '<span class="hint">Searching…</span>';
      const parts = q.split(',');
      const extra = parts.slice(1).join(' ').trim().toLowerCase();
      fetchJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(parts[0].trim()), null, 15000)
        .then((j) => {
          const res = (j.results || []).slice();
          if (extra) {
            const score = (r) => (((r.admin1 || '') + ' ' + (r.country || '') + ' ' + (r.country_code || '')).toLowerCase().indexOf(extra) >= 0 ? 1 : 0);
            res.sort((a, b) => score(b) - score(a));
          }
          box.innerHTML = res.length
            ? res.map((r, i) => '<button type="button" class="place" data-i="' + i + '">' + esc(r.name) + '<small>' + esc([r.admin1, r.country].filter(Boolean).join(', ')) + '</small></button>').join('')
            : '<span class="hint">No matches — try just the town name.</span>';
          box.onclick = (e) => {
            const b = e.target.closest('[data-i]');
            if (!b) return;
            const r = res[+b.getAttribute('data-i')];
            place = { name: r.name + (r.admin1 ? ', ' + r.admin1 : ''), lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4) };
            $('#sPlaceNow', m).textContent = place.name;
            box.innerHTML = '';
          };
        })
        .catch((e) => { box.innerHTML = '<span class="hint">Search failed: ' + esc(e.message) + '</span>'; });
    }
    $('#sPlaceGo', m).addEventListener('click', searchPlace);
    $('#sPlaceQ', m).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchPlace(); } });

    $('#sGeo', m).addEventListener('click', () => {
      if (!navigator.geolocation) { toast('Location isn’t available on this device'); return; }
      $('#sPlaceNow', m).textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        (p) => {
          place = { name: 'Current location', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) };
          $('#sPlaceNow', m).textContent = place.name;
        },
        (err) => { $('#sPlaceNow', m).textContent = place.name || 'not set'; toast('Couldn’t get location — ' + err.message, 4000); },
        { timeout: 15000, maximumAge: 36e5 });
    });

    $('#sCopy', m).addEventListener('click', () => {
      const link = setupLink(collect());
      const out = $('#sLinkOut', m);
      out.value = link;
      out.classList.remove('hidden');
      out.focus();
      out.select();
      const done = () => toast('Setup link copied');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(done, () => {});
      else { try { if (document.execCommand('copy')) done(); } catch (e) { /* user can copy manually */ } }
    });

    $('#sImportBtn', m).addEventListener('click', () => {
      try {
        const r = readSetupLink(val('sImport'));
        const before = Object.assign({}, S);
        Object.assign(S, r.settings);
        saveSettings();
        save('hd.lastSetup', r.token);
        closeModal();
        applySettings(before);
        toast('Settings imported');
      } catch (e) { toast(e.message, 4000); }
    });

    $('#sSave', m).addEventListener('click', () => {
      const before = S;
      S = collect();
      // Calendar IDs belong to one Google account; start fresh if the connection changed.
      if (S.apiUrl !== before.apiUrl) S.calendarIds = null;
      saveSettings();
      closeModal();
      applySettings(before);
    });

    if (section === 'cam') setTimeout(() => { const el = $('#sCamSection', m); if (el) el.scrollIntoView({ block: 'start' }); }, 50);
  }

  function applySettings(before) {
    applyTheme();
    if (before.apiUrl !== S.apiUrl || before.apiKey !== S.apiKey) {
      data = emptyData();
      sync = { state: 'idle', at: null, msg: '' };
      save('hd.cache', null);
    }
    if (before.lat !== S.lat || before.lon !== S.lon || before.units !== S.units) weather = null;
    camPlaying = false;
    renderAll();
    renderCam();
    refreshWeather();
    refreshData();
  }

  /* ──────────────────────────── theme, night clock, wake lock ──────────────────────────── */

  const mqLight = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    const t = S.theme === 'auto' ? (mqLight && mqLight.matches ? 'light' : 'dark') : S.theme;
    document.documentElement.setAttribute('data-theme', t);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#eceff3' : '#0c0e13');
  }
  if (mqLight) {
    if (mqLight.addEventListener) mqLight.addEventListener('change', applyTheme);
    else if (mqLight.addListener) mqLight.addListener(applyTheme);
  }

  let wokeUntil = 0;
  const toMin = (hhmm) => { const p = String(hhmm || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
  function inNightWindow(now) {
    if (!S.nightMode) return false;
    const m = now.getHours() * 60 + now.getMinutes();
    const s = toMin(S.nightStart), e = toMin(S.nightEnd);
    if (s === e) return false;
    return s < e ? m >= s && m < e : m >= s || m < e;
  }
  function updateNight() {
    const on = inNightWindow(new Date()) && Date.now() > wokeUntil && !modalOpen;
    $('#night').classList.toggle('on', on);
    if (on) { // nudge the clock a little each minute to avoid screen burn-in
      const dx = Math.round(Math.random() * 6 - 3), dy = Math.round(Math.random() * 6 - 3);
      $('#nightInner').style.transform = 'translate(' + dx + 'vmin,' + dy + 'vmin)';
    }
  }

  let wakeLock = null;
  function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.hidden || wakeLock) return;
    navigator.wakeLock.request('screen')
      .then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); })
      .catch(() => { /* not supported or not allowed — use Auto-Lock: Never */ });
  }

  /* ──────────────────────────── main loop ──────────────────────────── */

  function renderAll() {
    renderClock();
    renderStatus();
    renderWeather();
    renderCalendar();
    renderTasks();
    renderGroceries();
    renderLunch();
  }

  const bootAt = Date.now();
  let lastMinute = -1;
  let lastDay = ymd(new Date());

  function onMinute(now) {
    const today = ymd(now);
    if (today !== lastDay) {
      lastDay = today;
      lunchOffset = 0;
      refreshData();
      refreshWeather();
    }
    if (lunchOffset !== 0 && Date.now() - lunchNavAt > 10 * 60e3) lunchOffset = 0;
    renderAll();
    updateNight();
    // A fresh start once a day keeps a page that runs for weeks healthy.
    if (now.getHours() === 3 && now.getMinutes() === 30 && Date.now() - bootAt > 36e5) location.reload();
  }

  function tick() {
    const now = new Date();
    renderClock();
    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      onMinute(now);
    }
  }

  function wire() {
    $('#aiBtn').addEventListener('click', openAskAI);
    $('#settingsBtn').addEventListener('click', () => openSettings());
    $('#status').addEventListener('click', () => {
      if (isDemo()) { openSettings(); return; }
      if (sync.msg && sync.state !== 'ok') toast(sync.msg, 6000);
      refreshData();
      refreshWeather();
    });

    $('#tasksBody').addEventListener('click', (e) => {
      const li = e.target.closest('[data-tid]');
      if (li) onTaskTap(li.getAttribute('data-tid'));
    });
    $('#groceryBody').addEventListener('click', (e) => {
      const li = e.target.closest('[data-gid]');
      if (li) onGroceryTap(li.getAttribute('data-gid'));
    });
    $('#groceryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#groceryInput');
      const v = inp.value;
      inp.value = '';
      addGroceryText(v, false);
    });
    $('#micBtn').addEventListener('click', () => {
      const inp = $('#groceryInput');
      dictate(inp, $('#micBtn'), (text) => { inp.value = ''; addGroceryText(text, true); });
    });

    $('#lunchPrev').addEventListener('click', () => { lunchOffset--; lunchNavAt = Date.now(); renderLunch(); });
    $('#lunchNext').addEventListener('click', () => { lunchOffset++; lunchNavAt = Date.now(); renderLunch(); });
    $('#lunchEdit').addEventListener('click', () => openLunchEditor());
    $('#lunchBody').addEventListener('click', (e) => {
      const li = e.target.closest('[data-date]');
      if (li) openLunchEditor(li.getAttribute('data-date'));
    });

    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.getAttribute('data-act');
      if (act === 'settings') openSettings();
      else if (act === 'settings-cam') openSettings('cam');
      else if (act === 'cam-full') openCamFull();
      else if (act === 'cam-play') playCam();
    });

    $('#modalWrap').addEventListener('click', (e) => { if (e.target === $('#modalWrap')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen) closeModal(); });

    $('#night').addEventListener('click', () => { wokeUntil = Date.now() + 2 * 60e3; updateNight(); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (Date.now() - lastRefresh > 60e3) refreshData();
      if (!weather || !weather.at || Date.now() - weather.at > 10 * 60e3) refreshWeather();
      requestWakeLock();
    });
    window.addEventListener('resize', fitForecast);
    window.addEventListener('orientationchange', () => setTimeout(fitForecast, 300));
    document.addEventListener('touchend', requestWakeLock, { passive: true });
    document.addEventListener('click', requestWakeLock);
  }

  function init() {
    $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.getAttribute('data-icon')); });
    applyTheme();
    weather = loadCachedWeather();
    wire();
    renderAll();
    renderCam();
    refreshData();
    refreshWeather();
    setInterval(tick, 1000);
    setInterval(() => { if (!document.hidden) refreshData(); }, 5 * 60e3);
    setInterval(() => { if (!document.hidden) refreshWeather(); }, 15 * 60e3);
    requestWakeLock();
    if (importedFromHash) setTimeout(() => toast('Settings imported from link'), 400);
  }

  init();
})();
