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
    message: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-4.5 4V5.5a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2z"/>',
    alert: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  };
  const icon = (name, cls) =>
    '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

  /* ──────────────────────────── settings ──────────────────────────── */

  // Bump this together with the ?v= numbers in index.html on every release.
  // The dashboard notices a new number on the website and reloads itself.
  const APP_VERSION = '1.5';

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
    taskListIds: null, // null = the script's default task lists ("Family"); or an array of list IDs picked in Settings
    groceryListId: '', // '' = the Google Tasks list called "Groceries"; or the list ID picked in Settings
    childName: '',
    nightMode: true,
    nightStart: '22:00',
    nightEnd: '06:00',
    msgTitle: 'Messages',
    msgNames: '',      // e.g. "Sam, Alex": the "For" buttons and coloured name tags on messages
    messageListId: '', // '' = the Google Tasks list called "Messages"; or the list ID picked in Settings
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

  const emptyData = () => ({ events: [], tasks: [], taskLists: [], taskListInfo: [], groceries: [], messages: [], messagesSupported: true, lunches: {}, errors: {}, loaded: false });
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

  // The calendars / task lists / grocery list chosen in Settings, sent with every request.
  function choiceParams() {
    const p = {};
    if (Array.isArray(S.calendarIds)) p.calendars = S.calendarIds;
    if (Array.isArray(S.taskListIds)) p.taskLists = S.taskListIds;
    if (S.groceryListId) p.groceryList = S.groceryListId;
    if (S.messageListId) p.messageList = S.messageListId;
    return p;
  }

  const Backend = {
    loadAll: () => isDemo() ? Promise.resolve(Demo.loadAll()) : api('all', Object.assign(calRange(), choiceParams())),
    // Everything Settings can choose from: { calendars, taskLists, groceryListId }
    listChoices: () => isDemo()
      ? Promise.resolve(Demo.choices())
      : api('lists').then((r) => ({ calendars: r.calendars || [], taskLists: r.taskLists || [], groceryListId: r.groceryListId || '', messageListId: r.messageListId || '' })),
    addTask: (t) => isDemo() ? Promise.resolve(Demo.addTask(t)) : api('addTask', Object.assign({ title: t.title, listId: t.listId || '', due: t.due || '' }, choiceParams())),
    completeTask: (t) => isDemo() ? Promise.resolve(Demo.completeTask(t)) : api('completeTask', Object.assign({ listId: t.listId, taskId: t.id }, choiceParams())),
    addGroceries: (items) => isDemo() ? Promise.resolve(Demo.addGroceries(items)) : api('addGrocery', Object.assign({ items: items }, choiceParams())),
    checkGrocery: (id) => isDemo() ? Promise.resolve(Demo.checkGrocery(id)) : api('checkGrocery', Object.assign({ id: id }, choiceParams())),
    setLunches: (map) => isDemo() ? Promise.resolve(Demo.setLunches(map)) : api('setLunches', { lunches: map }),
    addMessage: (text) => isDemo() ? Promise.resolve(Demo.addMessage(text)) : api('addMessage', Object.assign({ text: text }, choiceParams())),
    doneMessage: (id) => isDemo() ? Promise.resolve(Demo.doneMessage(id)) : api('doneMessage', Object.assign({ id: id }, choiceParams())),
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
        { id: 't2', listId: 'l2', list: 'Family', title: 'Call the plumber about the sink', due: d(0) },
        { id: 't3', listId: 'l2', list: 'Family', title: 'Sign field-trip permission form', due: d(1) },
        { id: 't4', listId: 'l2', list: 'Family', title: 'Return library books', due: d(3) },
        { id: 't5', listId: 'l1', list: 'My Tasks', title: 'Book flights for the holidays', due: null },
        { id: 't6', listId: 'l2', list: 'Family', title: 'Change furnace filter', due: null },
      ];
    }
    const TASK_LISTS = [
      { id: 'l1', name: 'My Tasks', shownByDefault: false },
      { id: 'l2', name: 'Family', shownByDefault: true },
      { id: 'lg', name: 'Groceries', shownByDefault: false },
      { id: 'lm', name: 'Messages', shownByDefault: false },
    ];
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
      if (!st.messages) { st.messages = demoMessages(); save('hd.demo', st); }
      if (!st.added) st.added = [];
      return st;
    }
    function demoMessages() {
      const names = msgNames(); // with no names set in Settings, the samples aren't addressed to anyone
      const to = (i) => (names[i] ? names[i] + ': ' : '');
      const ago = (mins) => new Date(Date.now() - mins * 6e4).toISOString();
      return [
        { id: 'm1', text: to(0) + 'Piano practice before screen time, please', updated: ago(25) },
        { id: 'm2', text: to(1) + 'Library books are on the bench. Take them to school!', due: ymd(today0()), updated: ago(140) },
        { id: 'm3', text: 'Pizza and movie night on Friday', notes: 'Vote for the movie at dinner', updated: ago(26 * 60) },
      ];
    }
    function taskPayload(st) {
      const ids = Array.isArray(S.taskListIds) ? S.taskListIds : TASK_LISTS.filter((l) => l.shownByDefault).map((l) => l.id);
      const shownLists = TASK_LISTS.filter((l) => ids.indexOf(l.id) >= 0);
      return {
        lists: shownLists.map((l) => l.name),
        listInfo: shownLists.map((l) => ({ id: l.id, name: l.name, isDefault: l.shownByDefault })),
        items: tasks().concat(st.added).filter((t) => ids.indexOf(t.listId) >= 0 && st.done.indexOf(t.id) < 0),
      };
    }
    return {
      loadAll() {
        const st = state();
        return { calendar: { events: events().filter(shown) }, tasks: taskPayload(st), groceries: st.groceries.slice(), messages: st.messages.slice(), lunches: Object.assign({}, st.lunches), errors: {} };
      },
      choices() {
        return {
          calendars: Object.keys(CALS).map((k) => ({
            id: k, name: k === 'kid' ? (S.childName || CALS.kid.name) : CALS[k].name, color: CALS[k].color, shownByDefault: true,
          })),
          taskLists: TASK_LISTS.map((l) => Object.assign({}, l)),
          groceryListId: 'lg',
          messageListId: 'lm',
        };
      },
      completeTask(t) { const st = state(); st.done.push(t.id); save('hd.demo', st); return { tasks: taskPayload(st) }; },
      addTask(t) {
        const st = state();
        const list = TASK_LISTS.filter((l) => l.id === t.listId)[0] || TASK_LISTS.filter((l) => l.shownByDefault)[0];
        st.added.push({ id: 'ta' + (++st.seq), listId: list.id, list: list.name, title: t.title, due: t.due || null });
        save('hd.demo', st);
        return { tasks: taskPayload(st) };
      },
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
      addMessage(text) {
        const st = state();
        st.messages.unshift({ id: 'm' + (++st.seq), text: text, updated: new Date().toISOString() });
        save('hd.demo', st);
        return { messages: st.messages.slice() };
      },
      doneMessage(id) {
        const st = state();
        st.messages = st.messages.filter((x) => x.id !== id);
        save('hd.demo', st);
        return { messages: st.messages.slice() };
      },
      setLunches(map) {
        const st = state();
        Object.keys(map).forEach((k) => { if (map[k]) st.lunches[k] = map[k]; else delete st.lunches[k]; });
        save('hd.demo', st);
        return { lunches: Object.assign({}, st.lunches) };
      },
      weather() {
        const f = S.units === 'F';
        const T = (c) => (f ? c * 9 / 5 + 32 : c);
        const W = (k) => (f ? k * 0.621 : k);
        const at = (date, h, m) => { const x = new Date(date); x.setHours(h, m, 0, 0); return x; };
        // [code, high, low, chance %, precipitation mm, UV, max wind km/h, wind direction°]
        const days = [[2, 6, -1, 10, 0, 2, 14, 290], [61, 8, 3, 80, 6, 1, 22, 200], [3, 5, 0, 20, 0, 1, 12, 250],
          [71, 1, -4, 70, 4, 1, 18, 20], [0, 2, -6, 0, 0, 2, 9, 310], [1, 4, -3, 5, 0, 2, 11, 270], [80, 7, 1, 55, 3, 1, 25, 180]];
        const daily = days.map((d, i) => {
          const date = addDays(today0(), i);
          return { date: date, code: d[0], max: T(d[1]), min: T(d[2]), pp: d[3], precipSum: f ? d[4] / 25.4 : d[4], uv: d[5],
            windMax: W(d[6]), windDir: d[7], sunrise: at(date, 7, 18), sunset: at(date, 16, 37) };
        });
        const hourly = [];
        for (let i = 0; i < 7 * 24; i++) {
          const time = new Date(today0().getTime() + i * 36e5), hr = time.getHours(), d = daily[Math.floor(i / 24)];
          const warm = (1 - Math.cos(((hr - 5) / 24) * 2 * Math.PI)) / 2; // coldest ~5 AM, warmest ~5 PM
          const pp = hr >= 12 && hr <= 20 ? d.pp : Math.round(d.pp / 3);
          hourly.push({ time: time, temp: d.min + (d.max - d.min) * warm, pp: pp, code: pp >= 50 ? d.code : (d.code >= 51 ? 3 : d.code), isDay: hr >= 7 && hr < 17 });
        }
        const h = new Date().getHours();
        return {
          sample: true,
          units: S.units,
          current: { temp: T(4), feels: T(1), code: 2, isDay: h >= 7 && h < 17, wind: W(14), gust: W(31), windDir: 290, humidity: 72, precip: 0 },
          daily: daily,
          hourly: hourly,
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
    if (res.tasks) applyTaskPayload(res.tasks);
    if (res.groceries) data.groceries = res.groceries;
    if (res.messages) data.messages = res.messages;
    // An Apps Script from before Messages existed sends no 'messages' at all.
    data.messagesSupported = !!res.messages || !!errors.messages;
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
    const at = (arr, i) => (arr ? arr[i] : undefined);
    return {
      units: units,
      current: {
        temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, isDay: !!c.is_day,
        wind: c.wind_speed_10m, gust: c.wind_gusts_10m, windDir: c.wind_direction_10m, humidity: c.relative_humidity_2m, precip: c.precipitation,
      },
      daily: d.time.map((t, i) => ({
        date: parseYmd(t), code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
        pp: at(d.precipitation_probability_max, i), precipSum: at(d.precipitation_sum, i), uv: at(d.uv_index_max, i),
        windMax: at(d.wind_speed_10m_max, i), windDir: at(d.wind_direction_10m_dominant, i),
        sunrise: d.sunrise ? parseLocal(d.sunrise[i]) : null, sunset: d.sunset ? parseLocal(d.sunset[i]) : null,
      })),
      hourly: h.time.map((t, i) => ({
        time: parseLocal(t), temp: at(h.temperature_2m, i), pp: at(h.precipitation_probability, i), code: at(h.weather_code, i), isDay: at(h.is_day, i),
      })),
    };
  }

  const WEATHER_CACHE = 'hd.weather2'; // v2 holds the extra detail fields

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
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
      '&hourly=temperature_2m,precipitation_probability,weather_code,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset' +
      '&timezone=auto&forecast_days=7' +
      (units === 'F' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' : '&wind_speed_unit=kmh');
    return fetchJSON(url, null, 15000)
      .then((j) => {
        weather = normalizeWeather(j, units);
        weather.at = Date.now();
        weatherErr = '';
        save(WEATHER_CACHE, { raw: j, units: units, lat: S.lat, lon: S.lon, at: weather.at });
      })
      .catch((err) => { weatherErr = 'Weather unavailable (' + err.message + ')'; console.warn(err); })
      .then(renderWeather);
  }

  function loadCachedWeather() {
    const c = load(WEATHER_CACHE, null);
    if (!c || c.lat !== S.lat || c.lon !== S.lon || c.units !== S.units || Date.now() - c.at > 6 * 36e5) return null;
    try { const w = normalizeWeather(c.raw, c.units); w.at = c.at; return w; } catch (e) { return null; }
  }

  // Rain/snow likely (≥50%) in the next 12 hours → { what, now, time }
  function precipSoon(w) {
    const now = Date.now();
    const next = (w.hourly || []).filter((h) => h.time.getTime() > now - 36e5).slice(0, 12);
    for (let i = 0; i < next.length; i++) {
      if (next[i].pp >= 50) {
        const k = wxKind(next[i].code);
        return { what: k === 'snow' ? 'Snow' : k === 'storm' ? 'Storms' : 'Rain', now: i === 0, time: next[i].time };
      }
    }
    return null;
  }

  // The card: just the icon, temperature and "feels like" (tap for everything else).
  function renderWeather() {
    const el = $('#weather');
    const w = weather;
    if (!w) {
      setHTML(el, '<div class="wx-empty">' + esc(weatherErr || 'Loading weather…') + '</div>');
      return;
    }
    const c = w.current, r = Math.round;
    const soon = w.sample ? null : precipSoon(w);
    const tag = weatherErr ? '<span class="wx-tag bad">Offline</span>'
      : soon ? '<span class="wx-tag">' + esc(soon.what + (soon.now ? ' now' : ' ~' + fmtHour(soon.time))) + '</span>'
      : w.sample ? '<span class="wx-tag muted">Sample</span>' : '';
    const days = w.daily.slice(1, 7).map((d, i) =>
      '<button type="button" class="wx-day" data-wx="' + (i + 1) + '" aria-label="' + DOW_LONG[d.date.getDay()] + ' weather">' +
        '<span class="wx-dow">' + DOW[d.date.getDay()] + '</span>' +
        '<span class="wx-icon">' + wxIcon(d.code, true) + '</span>' +
        '<span class="wx-hl"><b>' + r(d.max) + '°</b><span>' + r(d.min) + '°</span></span>' +
        '<span class="wx-pp">' + (d.pp >= 20 ? d.pp + '%' : '') + '</span>' +
      '</button>').join('');
    setHTML(el,
      '<button type="button" class="wx-now" data-wx="0" aria-label="Today’s weather details">' +
        '<span class="wx-icon">' + wxIcon(c.code, c.isDay) + '</span>' +
        '<span class="wx-temp">' + r(c.temp) + '°</span>' +
        '<span class="wx-text"><span class="wx-feels">Feels ' + r(c.feels) + '°</span>' + tag + '</span>' +
      '</button>' +
      '<div class="wx-days">' + days + '</div>');
    fitForecast();
  }

  // ── the details pop-up ──
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const isNum = (v) => typeof v === 'number' && !isNaN(v);
  const compass = (deg) => (isNum(deg) ? COMPASS[Math.round(deg / 45) % 8] : '');
  const uvLabel = (uv) => (uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme');
  function fmtPrecip(v, units) {
    if (!(v > 0)) return 'None';
    return units === 'F' ? (v < 0.01 ? '< 0.01' : v.toFixed(2)) + ' in' : (v < 0.1 ? '< 0.1' : v.toFixed(1)) + ' mm';
  }

  function weatherDetailHTML(i) {
    const w = weather, d = w.daily[i], c = w.current, r = Math.round, today = i === 0;
    const windUnit = w.units === 'F' ? 'mph' : 'km/h';
    const name = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DOW_LONG[d.date.getDay()];
    const when = MON_LONG[d.date.getMonth()] + ' ' + d.date.getDate();
    const code = today ? c.code : d.code;
    let html = '<div class="wx-hero"><span class="wx-icon">' + wxIcon(code, today ? c.isDay : true) + '</span><div>' +
      '<div class="wx-hero-temp">' + (today ? r(c.temp) + '°' : r(d.max) + '°<span> / ' + r(d.min) + '°</span>') + '</div>' +
      '<div class="wx-hero-cond">' + esc(WMO[code] || '') + '</div>' +
      '<div class="wx-hero-sub">' + esc([name + ', ' + when, S.place ? S.place.split(',')[0] : ''].filter(Boolean).join(' · ')) + '</div>' +
      '</div></div>';

    if (today && !w.sample) {
      const soon = precipSoon(w);
      if (soon) html += '<div class="wx-banner">' + esc(soon.what + ' likely ' + (soon.now ? 'now' : 'around ' + fmtHour(soon.time))) + '</div>';
    }

    const now = Date.now();
    const hours = today
      ? (w.hourly || []).filter((h) => h.time.getTime() > now - 36e5).slice(0, 12)
      : (w.hourly || []).filter((h) => ymd(h.time) === ymd(d.date) && h.time.getHours() % 3 === 0);
    if (hours.some((h) => isNum(h.temp))) {
      html += '<div class="wx-hours">' + hours.map((h, k) => {
        const day = h.isDay == null ? h.time.getHours() >= 7 && h.time.getHours() < 18 : !!h.isDay;
        return '<div class="wx-hour"><span class="wx-h-time">' + (today && k === 0 ? 'Now' : esc(fmtHour(h.time))) + '</span>' +
          '<span class="wx-icon">' + wxIcon(h.code, day) + '</span>' +
          '<span class="wx-h-temp">' + (isNum(h.temp) ? r(h.temp) + '°' : '') + '</span>' +
          '<span class="wx-pp">' + (h.pp >= 10 ? h.pp + '%' : '') + '</span></div>';
      }).join('') + '</div>';
    }

    const stats = [];
    const add = (k, v) => { if (v) stats.push('<div class="wx-stat"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'); };
    if (today) add('Feels like', isNum(c.feels) ? r(c.feels) + '°' : '');
    add('High / Low', r(d.max) + '° / ' + r(d.min) + '°');
    add('Chance of ' + (wxKind(d.code) === 'snow' ? 'snow' : 'rain'), isNum(d.pp) ? d.pp + '%' : '');
    add('Precipitation', isNum(d.precipSum) ? fmtPrecip(d.precipSum, w.units) : '');
    if (today) add('Wind', isNum(c.wind) ? r(c.wind) + ' ' + windUnit + ' ' + compass(c.windDir) + (isNum(c.gust) && c.gust >= c.wind + 8 ? '<small class="line">gusts ' + r(c.gust) + ' ' + windUnit + '</small>' : '') : '');
    else add('Wind', isNum(d.windMax) ? 'up to ' + r(d.windMax) + ' ' + windUnit + ' ' + compass(d.windDir) : '');
    if (today) add('Humidity', isNum(c.humidity) ? r(c.humidity) + '%' : '');
    add('UV index', isNum(d.uv) ? r(d.uv) + '<small>' + uvLabel(d.uv) + '</small>' : '');
    if (d.sunrise && d.sunset) add('Sunrise / Sunset', esc(fmtTimeStr(d.sunrise)) + '<small class="line">' + esc(fmtTimeStr(d.sunset)) + '</small>');
    html += '<div class="wx-stats">' + stats.join('') + '</div>';
    html += '<p class="wx-foot">' + (w.sample
      ? 'Sample weather. Set your town in Settings → Weather.'
      : 'Updated ' + esc(fmtTimeStr(new Date(w.at))) + ' · Open-Meteo' + (weatherErr ? ' · ' + esc(weatherErr) : '')) + '</p>';
    return html;
  }

  function openWeatherDetail(i) {
    if (!weather || !weather.daily || !weather.daily.length) return;
    const n = Math.min(7, weather.daily.length);
    let chips = '';
    for (let k = 0; k < n; k++) chips += '<button type="button" class="chip" data-day="' + k + '">' + (k === 0 ? 'Today' : DOW[weather.daily[k].date.getDay()]) + '</button>';
    const m = openModal(
      '<div class="modal-head"><div class="chips wx-daychips">' + chips + '</div>' +
      '<button class="icon-btn" type="button" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      '<div id="wxDetail"></div>',
      { cls: 'modal-wx' });
    const show = (k) => {
      $('#wxDetail', m).innerHTML = weatherDetailHTML(k);
      $$('[data-day]', m).forEach((b) => b.classList.toggle('on', +b.getAttribute('data-day') === k));
    };
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-day]'); if (b) show(+b.getAttribute('data-day')); });
    show(Math.max(0, Math.min(n - 1, i || 0)));
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

  const pending = { t: {}, g: {}, m: {} }; // items checked off but not yet sent (tap again to undo)

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
        return '<li class="task' + (di && di.cls ? ' ' + di.cls : '') + (pending.t[t.id] ? ' done' : '') + (t.saving ? ' saving' : '') + '" data-tid="' + esc(t.id) + '">' +
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

  function applyTaskPayload(tp) {
    data.tasks = tp.items || [];
    data.taskLists = tp.lists || [];
    data.taskListInfo = tp.listInfo || []; // older Apps Scripts don't send this
  }

  function onTaskTap(id) {
    if (id.indexOf('tmp') === 0) return;
    const t = (data.tasks || []).filter((x) => x.id === id)[0];
    if (!t) return;
    toggleDone('t', id, () => {
      data.tasks = data.tasks.filter((x) => x.id !== id);
      renderTasks();
      Backend.completeTask(t)
        .then((res) => { if (res && res.tasks) { applyTaskPayload(res.tasks); renderTasks(); } })
        .catch((err) => { data.tasks.push(t); renderTasks(); toast('Couldn’t complete task — ' + err.message, 5000); });
    }, renderTasks);
  }

  // Lists a new task can go into: the lists shown in the Tasks card.
  function taskListOptions() {
    if (data.taskListInfo && data.taskListInfo.length) return data.taskListInfo;
    const seen = {}, out = []; // older Apps Script: work them out from the tasks themselves
    (data.tasks || []).forEach((t) => { if (t.listId && !seen[t.listId] && t.listId.indexOf('tmp') !== 0) { seen[t.listId] = 1; out.push({ id: t.listId, name: t.list }); } });
    return out;
  }

  function addTaskText(title, listId, due) {
    const list = (taskListOptions().filter((l) => l.id === listId)[0] || {}).name || '';
    const temp = { id: 'tmp' + Date.now(), listId: 'tmp', list: list, title: title, due: due || null, saving: true };
    data.tasks = (data.tasks || []).concat([temp]);
    renderTasks();
    Backend.addTask({ title: title, listId: listId, due: due })
      .then((res) => {
        if (res && res.tasks) applyTaskPayload(res.tasks); else temp.saving = false;
        renderTasks();
        toast('Task added' + (list ? ' to ' + list : ''));
      })
      .catch((err) => {
        data.tasks = data.tasks.filter((x) => x !== temp);
        renderTasks();
        toast(/Unknown action/.test(err.message)
          ? 'To add tasks here, paste the newest Code.gs into Apps Script and deploy a new version (see README).'
          : 'Couldn’t add task — ' + err.message, 6000);
      });
  }

  function openTaskComposer() {
    const lists = taskListOptions();
    const last = load('hd.lastTaskList', '');
    // last list used here, else the default list (Family), else the first one shown
    let listId = (lists.filter((l) => l.id === last)[0] || lists.filter((l) => l.isDefault)[0] || lists[0] || {}).id || '';
    let due = '';
    const chip = (attr, value, label, on) => '<button type="button" class="chip' + (on ? ' on' : '') + '" ' + attr + '="' + esc(value) + '">' + esc(label) + '</button>';
    const m = openModal(
      '<div class="modal-head"><h2>New task</h2><button class="icon-btn" type="button" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      '<form class="ask-row" data-task><input type="text" id="taskText" placeholder="What needs doing?" maxlength="300" autocomplete="off">' +
      '<button type="button" class="round-btn mic" id="taskMic" aria-label="Say the task">' + icon('mic') + '</button></form>' +
      (lists.length > 1
        ? '<div class="chips-label">List</div><div class="chips">' + lists.map((l) => chip('data-list', l.id, l.name, l.id === listId)).join('') + '</div>'
        : '<p class="hint task-dest">' + (lists.length ? 'Adds to <b>' + esc(lists[0].name) + '</b>.' : 'Adds to your first task list.') + '</p>') +
      '<div class="chips-label">Due</div><div class="chips">' +
        chip('data-due', '', 'No date', true) + chip('data-due', 'today', 'Today') + chip('data-due', 'tomorrow', 'Tomorrow') +
        '<input type="date" id="taskDue" class="date-chip" aria-label="Pick a due date"></div>' +
      '<div class="modal-foot"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" data-add>Add task</button></div>',
      { cls: 'modal-task' });
    const input = $('#taskText', m), dateBox = $('#taskDue', m);
    const send = () => {
      const title = input.value.trim();
      if (!title) { input.focus(); return; }
      if (listId) save('hd.lastTaskList', listId);
      const when = due === 'today' ? ymd(new Date()) : due === 'tomorrow' ? ymd(addDays(new Date(), 1)) : due;
      closeModal();
      addTaskText(title, listId, when);
    };
    m.addEventListener('click', (e) => {
      const l = e.target.closest('[data-list]');
      if (l) { listId = l.getAttribute('data-list'); $$('[data-list]', m).forEach((c) => c.classList.toggle('on', c === l)); return; }
      const d = e.target.closest('[data-due]');
      if (d) {
        due = d.getAttribute('data-due');
        dateBox.value = '';
        dateBox.classList.remove('on');
        $$('[data-due]', m).forEach((c) => c.classList.toggle('on', c === d));
        return;
      }
      if (e.target.closest('[data-add]')) send();
    });
    dateBox.addEventListener('change', () => {
      due = dateBox.value || '';
      dateBox.classList.toggle('on', !!due);
      $$('[data-due]', m).forEach((c) => c.classList.toggle('on', !due && c.getAttribute('data-due') === ''));
    });
    $('[data-task]', m).addEventListener('submit', (e) => { e.preventDefault(); send(); });
    $('#taskMic', m).addEventListener('click', () => dictate(input, $('#taskMic', m), () => {}));
    input.focus();
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

  /* ──────────────────────────── messages ──────────────────────────── */

  // Names from Settings ("Sam, Alex"): the "For" buttons and the coloured name tags.
  const msgNames = () => String(S.msgNames || '').split(/,|&|\band\b/i).map((x) => x.trim()).filter(Boolean).slice(0, 8);
  const NAME_COLORS = ['#ff9f6b', '#6cb4ff', '#c29bff', '#5fd39b', '#f5c04f', '#ff8b9b'];
  function nameColor(name) {
    let i = msgNames().map((n) => n.toLowerCase()).indexOf(name.toLowerCase());
    if (i < 0) { i = 0; for (let k = 0; k < name.length; k++) i = (i * 31 + name.charCodeAt(k)) >>> 0; }
    return NAME_COLORS[i % NAME_COLORS.length];
  }
  // "Alex: piano at 4" → { to: "Alex", text: "piano at 4" }. Only names from Settings count, so "Note: …" stays as text.
  function splitRecipient(text) {
    const m = /^\s*([^:]{1,24}):\s*([\s\S]+)$/.exec(text || '');
    if (m) {
      const who = m[1].trim().toLowerCase();
      const known = msgNames().filter((n) => n.toLowerCase() === who)[0];
      if (known) return { to: known, text: m[2] };
    }
    return { to: '', text: text || '' };
  }
  function timeAgo(iso) {
    const t = iso ? new Date(iso) : null;
    if (!t || isNaN(t)) return '';
    const mins = Math.round((Date.now() - t) / 6e4);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const days = Math.round((startOfDay(new Date()) - startOfDay(t)) / DAY);
    if (days <= 0) return Math.round(mins / 60) + ' h ago';
    if (days === 1) return 'yesterday';
    if (days < 7) return DOW_LONG[t.getDay()];
    return MON[t.getMonth()] + ' ' + t.getDate();
  }
  function forDay(due) {
    if (!due) return '';
    const d = parseYmd(due), diff = Math.round((d - startOfDay(new Date())) / DAY);
    if (diff < 0) return '';
    if (diff === 0) return 'for today';
    if (diff === 1) return 'for tomorrow';
    return 'for ' + (diff < 7 ? DOW_LONG[d.getDay()] : MON[d.getMonth()] + ' ' + d.getDate());
  }
  const msgTitle = () => (S.msgTitle || '').trim() || 'Messages';

  function renderMessages() {
    $('#msgTitle').textContent = msgTitle();
    const items = data.messages || [];
    let html = data.errors.messages ? cardError(data.errors.messages) : '';
    if (data.loaded && !isDemo() && !data.messagesSupported) {
      html += '<div class="empty">To use Messages, paste the newest Code.gs into Apps Script and deploy a new version (see README).</div>';
    } else if (!items.length) {
      html += data.loaded ? '<div class="empty">No messages. Tap + to leave one, or add one to the Messages list in Google Tasks.</div>' : '';
    } else {
      html += '<ul class="msg-list">' + items.map((x) => {
        const r = splitRecipient(x.text);
        const meta = [forDay(x.due), timeAgo(x.updated)].filter(Boolean).join(' · ');
        return '<li class="msg' + (pending.m[x.id] ? ' done' : '') + (x.saving ? ' saving' : '') + '" data-mid="' + esc(x.id) + '">' +
          (r.to ? '<span class="msg-to" style="--n:' + nameColor(r.to) + '">' + esc(r.to) + '</span>' : '') +
          '<span class="msg-text">' + esc(r.text) + '</span>' +
          (x.notes ? '<span class="msg-notes">' + esc(x.notes) + '</span>' : '') +
          (meta ? '<span class="msg-meta">' + esc(meta) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    setHTML($('#msgBody'), html);
  }

  function onMessageTap(id) {
    if (id.indexOf('tmp') === 0) return;
    const x = (data.messages || []).filter((y) => y.id === id)[0];
    if (!x) return;
    toggleDone('m', id, () => {
      data.messages = data.messages.filter((y) => y.id !== id);
      renderMessages();
      Backend.doneMessage(id)
        .then((res) => { if (res && res.messages) { data.messages = res.messages; renderMessages(); } })
        .catch((err) => { data.messages.push(x); renderMessages(); toast('Couldn’t clear message — ' + err.message, 5000); });
    }, renderMessages);
  }

  function addMessageText(text) {
    const temp = { id: 'tmp' + Date.now(), text: text, updated: new Date().toISOString(), saving: true };
    data.messages = [temp].concat(data.messages || []);
    renderMessages();
    Backend.addMessage(text)
      .then((res) => {
        data.messages = res && res.messages ? res.messages : data.messages.map((y) => (y === temp ? { id: y.id, text: y.text, updated: y.updated } : y));
        renderMessages();
        toast('Message posted');
      })
      .catch((err) => {
        data.messages = data.messages.filter((y) => y !== temp);
        renderMessages();
        toast('Couldn’t post — ' + err.message, 5000);
      });
  }

  function openMessageComposer() {
    const names = msgNames();
    const m = openModal(
      '<div class="modal-head"><h2>New message</h2><button class="icon-btn" type="button" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      (names.length
        ? '<div class="chips-label">For</div><div class="chips">' + ['Everyone'].concat(names).map((n, i) =>
            '<button type="button" class="chip' + (i === 0 ? ' on' : '') + '" data-to="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>'
        : '') +
      '<form class="ask-row msg-compose" data-msg><input type="text" id="msgText" placeholder="Write a message…" maxlength="300" autocomplete="off">' +
      '<button type="button" class="round-btn mic" id="msgMic" aria-label="Say the message">' + icon('mic') + '</button></form>' +
      '<div class="modal-foot"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" data-send>Post message</button></div>',
      { cls: 'modal-msg' });
    const input = $('#msgText', m);
    let to = 'Everyone';
    const send = () => {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      closeModal();
      addMessageText((to !== 'Everyone' ? to + ': ' : '') + text);
    };
    m.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-to]');
      if (chip) { to = chip.getAttribute('data-to'); $$('[data-to]', m).forEach((c) => c.classList.toggle('on', c === chip)); return; }
      if (e.target.closest('[data-send]')) send();
    });
    $('[data-msg]', m).addEventListener('submit', (e) => { e.preventDefault(); send(); });
    $('#msgMic', m).addEventListener('click', () => dictate(input, $('#msgMic', m), () => {}));
    input.focus();
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
    // A fresh element each time, so click handlers from earlier dialogs can't fire again
    // (they would re-send an old task, re-save an old lunch week, or open two AI windows).
    const old = $('#modal');
    const m = old.cloneNode(false);
    old.parentNode.replaceChild(m, old);
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

  function openSettings() {
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

        <fieldset id="sTaskSection">
          <legend>Tasks</legend>
          <div class="cal-picks" id="sTaskLists"><span class="hint">Loading your task lists…</span></div>
          <div class="row"><button class="btn small" type="button" id="sTasksReset">Use default</button><span class="hint cal-note" id="sTasksNote"></span></div>
          <p class="hint">Choose which Google Tasks lists appear in the Tasks card.</p>
        </fieldset>

        <fieldset id="sGrocSection">
          <legend>Groceries</legend>
          <label class="field"><span>Google Tasks list used for groceries</span>
            <select id="sGrocList"><option value="">Loading…</option></select></label>
          <p class="hint">Items you add on the dashboard (typed or by voice) go into this list. Checking items off here or in the Google Tasks app on your phone updates both.</p>
        </fieldset>

        <fieldset id="sMsgSection">
          <legend>Messages</legend>
          <div class="grid2">
            <label class="field"><span>Card title</span><input id="sMsgTitle" type="text" value="${esc(S.msgTitle)}" placeholder="e.g. Messages for the kids"></label>
            <label class="field"><span>Names, separated by commas</span><input id="sMsgNames" type="text" value="${esc(S.msgNames)}" placeholder="e.g. Sam, Alex"></label>
          </div>
          <label class="field"><span>Google Tasks list used for messages</span>
            <select id="sMsgList"><option value="">Loading…</option></select></label>
          <p class="hint">Post from your phone by adding a task to this list in Google Tasks. Start it with a name and a colon (“Sam: piano at 4”) to address someone; on the iPad, tap + and pick who it’s for. Tap a message on the dashboard to clear it.</p>
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
      <div class="modal-foot">
        <button class="btn" type="button" id="sReload">Reload dashboard</button><span class="ver">Version ${APP_VERSION}</span>
        <span class="grow"></span>
        <button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="sSave">Save</button>
      </div>
    `, { cls: 'modal-settings' });

    const val = (id) => $('#' + id, m).value.trim();

    $('#sReload', m).addEventListener('click', () => location.reload());

    // ── checkboxes for calendars and task lists ──
    // choice === null means "use the default"; otherwise it's the list of ticked IDs.
    function picker(boxId, noteId, resetId, initial, describeDefault) {
      const box = $('#' + boxId, m), note = $('#' + noteId, m);
      const st = { choice: Array.isArray(initial) ? initial.slice() : null, items: null, disabled: {} };
      st.render = () => {
        if (!st.items) return;
        box.innerHTML = st.items.length
          ? st.items.map((c) => {
              const off = st.disabled[c.id] || '';
              const on = !off && (st.choice ? st.choice.indexOf(c.id) >= 0 : c.shownByDefault);
              return '<label class="cal-pick' + (off ? ' off' : '') + '"><input type="checkbox" value="' + esc(c.id) + '"' +
                (on ? ' checked' : '') + (off ? ' disabled' : '') + '>' +
                (c.color ? '<span class="swatch" style="background:' + safeColor(c.color) + '"></span>' : '') +
                '<span class="nm">' + esc(c.name) + (off ? ' <small>(used for ' + esc(off) + ')</small>' : '') + '</span></label>';
            }).join('')
          : '<span class="hint">Nothing found in this Google account.</span>';
        note.textContent = st.choice ? '' : describeDefault(st.items);
      };
      box.addEventListener('change', () => {
        st.choice = $$('input', box).filter((i) => i.checked && !i.disabled).map((i) => i.value);
        note.textContent = st.choice.length ? '' : 'Nothing ticked: this card will be empty.';
      });
      $('#' + resetId, m).addEventListener('click', () => { st.choice = null; st.render(); });
      st.fail = (msg) => { box.innerHTML = '<span class="hint">' + esc(msg) + '</span>'; $('#' + resetId, m).classList.add('hidden'); };
      return st;
    }
    const calPick = picker('sCals', 'sCalsNote', 'sCalsReset', S.calendarIds, () => 'Showing the calendars ticked in Google Calendar.');
    const taskPick = picker('sTaskLists', 'sTasksNote', 'sTasksReset', S.taskListIds, (items) => {
      const d = items.filter((l) => l.shownByDefault && !taskPick.disabled[l.id]).map((l) => l.name);
      return 'Showing the default: ' + (d.length ? listJoin(d) : 'all lists') + '.';
    });

    // ── grocery list menu ──
    const grocSel = $('#sGrocList', m), msgSel = $('#sMsgList', m);
    let grocChoice = S.groceryListId || '';
    let msgChoice = S.messageListId || '';
    function markGroceryList() { // the grocery and message lists can't also be ticked under Tasks
      taskPick.disabled = {};
      if (grocSel.value) taskPick.disabled[grocSel.value] = 'Groceries';
      if (msgSel.value) taskPick.disabled[msgSel.value] = 'Messages';
      taskPick.render();
    }
    grocSel.addEventListener('change', () => { grocChoice = grocSel.value; markGroceryList(); });
    msgSel.addEventListener('change', () => { msgChoice = msgSel.value; markGroceryList(); });
    const listOptions = (lists, current) => lists.map((l) =>
      '<option value="' + esc(l.id) + '"' + (l.id === current ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');

    const token = {};
    m._settingsToken = token;
    Backend.listChoices()
      .then((r) => {
        if (m._settingsToken !== token) return;
        calPick.items = r.calendars;
        calPick.render();
        taskPick.items = r.taskLists;
        const exists = (id) => r.taskLists.some((l) => l.id === id);
        if (grocChoice && !exists(grocChoice)) grocChoice = ''; // that list was deleted
        if (msgChoice && !exists(msgChoice)) msgChoice = '';
        grocSel.innerHTML = listOptions(r.taskLists, grocChoice || r.groceryListId);
        if (r.messageListId) msgSel.innerHTML = listOptions(r.taskLists, msgChoice || r.messageListId);
        else { // an Apps Script from before Messages existed
          msgSel.innerHTML = '<option value="">Messages (update the Apps Script to use)</option>';
          msgSel.disabled = true;
        }
        markGroceryList();
      })
      .catch((err) => {
        if (m._settingsToken !== token) return;
        const msg = /Unknown action/.test(err.message)
          ? 'To choose here, update your Apps Script to the newest Code.gs and deploy a new version (see README).'
          : 'Couldn’t load your lists: ' + err.message;
        calPick.fail(msg);
        taskPick.fail(msg);
        grocSel.innerHTML = '<option value="">Groceries (update the Apps Script to choose)</option>';
        grocSel.disabled = true;
        msgSel.innerHTML = '<option value="">Messages (update the Apps Script to use)</option>';
        msgSel.disabled = true;
      });

    function collect() {
      const grocery = grocSel.disabled ? (S.groceryListId || '') : grocChoice;
      const message = msgSel.disabled ? (S.messageListId || '') : msgChoice;
      const own = [grocery || grocSel.value, message || msgSel.value];
      return Object.assign({}, S, {
        calendarIds: calPick.choice,
        taskListIds: taskPick.choice ? taskPick.choice.filter((id) => own.indexOf(id) < 0) : null,
        groceryListId: grocery,
        messageListId: message,
        msgTitle: val('sMsgTitle'),
        msgNames: val('sMsgNames'),
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
      if (!grocSel.disabled && !msgSel.disabled && grocSel.value && grocSel.value === msgSel.value) {
        toast('Pick different Google Tasks lists for Groceries and Messages', 4500);
        return;
      }
      const before = S;
      S = collect();
      // Calendar and list IDs belong to one Google account; start fresh if the connection changed.
      if (S.apiUrl !== before.apiUrl) { S.calendarIds = null; S.taskListIds = null; S.groceryListId = ''; S.messageListId = ''; }
      saveSettings();
      closeModal();
      applySettings(before);
    });

  }

  function applySettings(before) {
    applyTheme();
    if (before.apiUrl !== S.apiUrl || before.apiKey !== S.apiKey) {
      data = emptyData();
      sync = { state: 'idle', at: null, msg: '' };
      save('hd.cache', null);
    }
    if (before.lat !== S.lat || before.lon !== S.lon || before.units !== S.units) weather = null;
    renderAll();
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
    renderMessages();
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

    $('#msgAdd').addEventListener('click', openMessageComposer);
    $('#weather').addEventListener('click', (e) => {
      const t = e.target.closest('[data-wx]');
      openWeatherDetail(t ? +t.getAttribute('data-wx') : 0);
    });
    $('#taskAdd').addEventListener('click', openTaskComposer);
    $('#msgBody').addEventListener('click', (e) => {
      const li = e.target.closest('[data-mid]');
      if (li) onMessageTap(li.getAttribute('data-mid'));
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
    });

    $('#modalWrap').addEventListener('click', (e) => { if (e.target === $('#modalWrap')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen) closeModal(); });

    $('#night').addEventListener('click', () => { wokeUntil = Date.now() + 2 * 60e3; updateNight(); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      checkForUpdate();
      if (Date.now() - lastRefresh > 60e3) refreshData();
      if (!weather || !weather.at || Date.now() - weather.at > 10 * 60e3) refreshWeather();
      requestWakeLock();
    });
    window.addEventListener('resize', fitForecast);
    window.addEventListener('orientationchange', () => setTimeout(fitForecast, 300));
    document.addEventListener('touchend', requestWakeLock, { passive: true });
    document.addEventListener('click', requestWakeLock);
  }

  // A wall-mounted iPad never gets reloaded by hand, so look for a newer version on
  // the website now and then and reload when one appears (once per version, so it
  // can't loop if the website is mid-update).
  let lastUpdateCheck = 0;
  function checkForUpdate() {
    if (Date.now() - lastUpdateCheck < 5 * 60e3 || !/^https?:/.test(location.protocol)) return;
    lastUpdateCheck = Date.now();
    fetch(location.pathname.replace(/[^/]*$/, '') + 'index.html?_=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => {
        const m = /app\.js\?v=([\w.-]+)/.exec(html);
        if (!m || m[1] === APP_VERSION || load('hd.reloadedFor', '') === m[1]) return;
        if (modalOpen) { lastUpdateCheck = 0; return; } // don't yank Settings away mid-edit; retry on the next check
        save('hd.reloadedFor', m[1]);
        location.reload();
      })
      .catch(() => { /* offline: try again later */ });
  }

  function init() {
    $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.getAttribute('data-icon')); });
    applyTheme();
    weather = loadCachedWeather();
    wire();
    renderAll();
    refreshData();
    refreshWeather();
    setInterval(tick, 1000);
    setInterval(() => { if (!document.hidden) refreshData(); }, 5 * 60e3);
    setInterval(() => { if (!document.hidden) refreshWeather(); }, 15 * 60e3);
    setInterval(() => { if (!document.hidden) checkForUpdate(); }, 30 * 60e3);
    setTimeout(checkForUpdate, 20e3);
    requestWakeLock();
    if (importedFromHash) setTimeout(() => toast('Settings imported from link'), 400);
  }

  init();
})();
