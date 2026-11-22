/**
 * HOME DASHBOARD — Google Apps Script back end
 * ---------------------------------------------------------------------------
 * A tiny private JSON API that runs inside YOUR Google account and gives the
 * iPad dashboard:
 *   • events merged from all your Google Calendars
 *   • your Google Tasks (tap to complete)
 *   • a grocery list — stored as a Google Tasks list called "Groceries", so it
 *     also shows up in the Google Tasks app on your phone at the store
 *   • the weekly school-lunch list
 *
 * Setup steps are in README.md ("Step 1"). In short:
 *   1. Paste this file into a new Apps Script project.
 *   2. Services (+) → add "Google Calendar API" and "Google Tasks API".
 *   3. Run setup() once → copy the dashboard key from the log.
 *   4. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
 */

const CONFIG = {
  // Which calendars appear is easiest to choose on the dashboard itself:
  // Settings → Calendars (checkboxes). Until you pick there, the dashboard
  // shows every calendar ticked in Google Calendar's left sidebar — or, if you
  // list calendar IDs here, only those (Google Calendar → Settings → the
  // calendar → "Integrate calendar" → Calendar ID).
  CALENDAR_IDS: [],

  // Calendars that should never appear (not even as a checkbox), by name or ID,
  // e.g. ['Birthdays', 'Holidays in Canada'].
  EXCLUDE_CALENDARS: [],

  // Rename calendars on the dashboard, by name or ID → new name.
  // e.g. { 'you@gmail.com': 'Me', 'Family calendar 2019': 'Family' }
  RENAME_CALENDARS: {},

  // Google Tasks list used for groceries (created automatically if missing).
  GROCERY_LIST_NAME: 'Groceries',

  // Google Tasks lists NOT to show in the dashboard's "Tasks" card.
  HIDE_TASK_LISTS: [],

  // Lunch entries older than this many days are deleted.
  LUNCH_HISTORY_DAYS: 120,
};

/* ───────────────────────── one-time setup ───────────────────────── */

/** Run this once from the editor. It asks for permissions and prints your key. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('DASHBOARD_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    props.setProperty('DASHBOARD_KEY', key);
  }
  const cals = listCalendars_();
  const lists = taskLists_().map(function (l) { return l.title; });
  groceryListId_();
  console.log('Calendars on the dashboard: ' + cals.map(function (c) { return c.name; }).join(', '));
  console.log('Task lists: ' + lists.join(', '));
  console.log('Grocery list: "' + CONFIG.GROCERY_LIST_NAME + '" (in Google Tasks)');
  console.log('YOUR DASHBOARD KEY →  ' + key);
}

/** Run this if your key ever leaks. Then paste the new key into the dashboard. */
function resetKey() {
  PropertiesService.getScriptProperties().deleteProperty('DASHBOARD_KEY');
  setup();
}

/* ───────────────────────── web app entry points ───────────────────────── */

function doGet(e) {
  return respond_((e && e.parameter) || {});
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  return respond_(Object.assign({}, (e && e.parameter) || {}, body));
}

function respond_(p) {
  let out;
  try {
    checkKey_(p.key);
    out = Object.assign({ ok: true }, route_(p.action || 'all', p));
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  out.serverTime = new Date().toISOString();
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('DASHBOARD_KEY');
  if (!expected) throw new Error('Run setup() in the Apps Script editor first.');
  if (String(key || '') !== expected) throw new Error('Wrong dashboard key.');
}

function route_(action, p) {
  switch (action) {
    case 'ping':
      return { message: 'Connected' };

    case 'all':
      return loadAll_(p);

    case 'calendars':
      // Every calendar the dashboard could show, for the checkboxes in its Settings.
      return { calendars: pickableCalendars_() };

    case 'completeTask':
      if (!p.listId || !p.taskId) throw new Error('Missing listId/taskId');
      Tasks.Tasks.patch({ status: 'completed' }, p.listId, p.taskId);
      return { tasks: getTasks_() };

    case 'addGrocery':
      // Accepts { items: ['Milk','Eggs'] } from the dashboard, or
      // { text: 'milk, eggs and bread' } from a Siri Shortcut.
      addGroceries_(p.items || p.item || p.text);
      return { groceries: getGroceries_() };

    case 'checkGrocery':
      if (!p.id) throw new Error('Missing id');
      Tasks.Tasks.patch({ status: 'completed' }, groceryListId_(), p.id);
      return { groceries: getGroceries_() };

    case 'setLunches':
      setLunches_(p.lunches || {});
      return { lunches: getLunches_() };

    default:
      throw new Error('Unknown action "' + action + '"');
  }
}

/** Everything the dashboard needs in one call. One failing section won't break the others. */
function loadAll_(p) {
  const out = { errors: {} };
  const part = function (name, fn) {
    try { out[name] = fn(); } catch (err) { out.errors[name] = String((err && err.message) || err); }
  };
  part('calendar', function () { return getEvents_(p.from, p.to, p.calendars); });
  part('tasks', getTasks_);
  part('groceries', getGroceries_);
  part('lunches', getLunches_);
  return out;
}

/* ───────────────────────── calendars ───────────────────────── */

let CALS_CACHE_ = null; // per-execution cache

function allCalendars_() {
  if (CALS_CACHE_) return CALS_CACHE_;
  const all = [];
  let pageToken;
  do {
    const res = Calendar.CalendarList.list({ maxResults: 250, pageToken: pageToken });
    (res.items || []).forEach(function (c) { all.push(c); });
    pageToken = res.nextPageToken;
  } while (pageToken);
  CALS_CACHE_ = all;
  return all;
}

function lower_(s) { return String(s || '').trim().toLowerCase(); }

function isExcluded_(c) {
  const exclude = CONFIG.EXCLUDE_CALENDARS.map(lower_);
  return exclude.indexOf(lower_(c.id)) !== -1 || exclude.indexOf(lower_(c.summaryOverride || c.summary)) !== -1;
}

function displayCalendar_(c) {
  const rename = {};
  Object.keys(CONFIG.RENAME_CALENDARS).forEach(function (k) { rename[lower_(k)] = CONFIG.RENAME_CALENDARS[k]; });
  let name = c.summaryOverride || c.summary || c.id;
  if (rename[lower_(c.id)]) name = rename[lower_(c.id)];
  else if (rename[lower_(name)]) name = rename[lower_(name)];
  else if (c.primary && name.indexOf('@') !== -1) name = 'Me';
  return { id: c.id, name: name, color: c.backgroundColor || '#4285f4' };
}

/**
 * The calendars to show. `ids` comes from the checkboxes in the dashboard's
 * Settings; when it's missing, fall back to CONFIG.CALENDAR_IDS, then to the
 * calendars ticked in Google Calendar.
 */
function listCalendars_(ids) {
  const all = allCalendars_();
  if (typeof ids === 'string') ids = ids.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  let chosen;
  if (Array.isArray(ids)) {
    chosen = all.filter(function (c) { return ids.indexOf(c.id) !== -1; });
  } else if (CONFIG.CALENDAR_IDS.length) {
    chosen = CONFIG.CALENDAR_IDS.map(function (id) {
      return all.filter(function (c) { return c.id === id; })[0] || { id: id, summary: id };
    });
  } else {
    chosen = all.filter(function (c) { return c.selected && !c.hidden; });
  }
  return chosen.filter(function (c) { return !isExcluded_(c); }).map(displayCalendar_);
}

/** Every calendar the dashboard could show; `shownByDefault` marks the ones it uses before you pick. */
function pickableCalendars_() {
  const defaults = {};
  listCalendars_().forEach(function (c) { defaults[c.id] = true; });
  return allCalendars_()
    .filter(function (c) { return !c.hidden && !isExcluded_(c); })
    .map(function (c) {
      return Object.assign(displayCalendar_(c), { shownByDefault: !!defaults[c.id], primary: !!c.primary });
    })
    .sort(function (a, b) {
      return (b.primary - a.primary) || a.name.localeCompare(b.name);
    });
}

function getEvents_(from, to, calendarIds) {
  const start = from ? new Date(from) : startOfToday_();
  const end = to ? new Date(to) : new Date(start.getTime() + 7 * 864e5);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) throw new Error('Bad date range');
  if (end - start > 62 * 864e5) throw new Error('Date range too long (max 62 days)');

  const cals = listCalendars_(calendarIds);
  const events = [];
  const byKey = {};
  const errors = [];

  cals.forEach(function (cal) {
    try {
      let pageToken;
      do {
        const res = Calendar.Events.list(cal.id, {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
          pageToken: pageToken,
          fields: 'nextPageToken,items(id,iCalUID,status,summary,location,start,end,attendees(self,responseStatus))',
        });
        (res.items || []).forEach(function (ev) {
          if (ev.status === 'cancelled' || !ev.start) return;
          const me = (ev.attendees || []).filter(function (a) { return a.self; })[0];
          if (me && me.responseStatus === 'declined') return;

          const startStr = ev.start.dateTime || ev.start.date;
          const endStr = (ev.end && (ev.end.dateTime || ev.end.date)) || startStr;

          // The same invite on two family calendars → show it once, list both calendars.
          const key = (ev.iCalUID || ev.id) + '|' + startStr;
          if (byKey[key]) {
            if (byKey[key].calendar.indexOf(cal.name) === -1) byKey[key].calendar += ', ' + cal.name;
            return;
          }
          const item = {
            id: ev.id,
            title: ev.summary || '(No title)',
            start: startStr,
            end: endStr,
            allDay: !ev.start.dateTime,
            location: ev.location || '',
            calendar: cal.name,
            color: cal.color,
          };
          byKey[key] = item;
          events.push(item);
        });
        pageToken = res.nextPageToken;
      } while (pageToken);
    } catch (err) {
      errors.push(cal.name + ': ' + ((err && err.message) || err));
    }
  });

  events.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  return {
    calendars: cals.map(function (c) { return { name: c.name, color: c.color }; }),
    events: events,
    errors: errors,
  };
}

function startOfToday_() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ───────────────────────── tasks ───────────────────────── */

let LISTS_CACHE_ = null; // per-execution cache

function taskLists_() {
  if (LISTS_CACHE_) return LISTS_CACHE_;
  LISTS_CACHE_ = [];
  let pageToken;
  do {
    const res = Tasks.Tasklists.list({ maxResults: 100, pageToken: pageToken });
    (res.items || []).forEach(function (l) { LISTS_CACHE_.push(l); });
    pageToken = res.nextPageToken;
  } while (pageToken);
  return LISTS_CACHE_;
}

function isGroceryList_(list) {
  return String(list.title || '').trim().toLowerCase() === CONFIG.GROCERY_LIST_NAME.trim().toLowerCase();
}

function listTasks_(listId) {
  const out = [];
  let pageToken;
  do {
    const res = Tasks.Tasks.list(listId, {
      showCompleted: false,
      showHidden: false,
      maxResults: 100,
      pageToken: pageToken,
    });
    (res.items || []).forEach(function (t) { out.push(t); });
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out
    .filter(function (t) { return t.title && String(t.title).trim(); })
    .sort(function (a, b) {
      const pa = a.position || '', pb = b.position || '';
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
}

function getTasks_() {
  const hide = CONFIG.HIDE_TASK_LISTS.map(function (s) { return String(s).trim().toLowerCase(); });
  const lists = taskLists_().filter(function (l) {
    return !isGroceryList_(l) && hide.indexOf(String(l.title).trim().toLowerCase()) === -1;
  });
  const items = [];
  lists.forEach(function (l) {
    listTasks_(l.id).forEach(function (t) {
      items.push({
        id: t.id,
        listId: l.id,
        list: l.title,
        title: String(t.title).trim(),
        notes: t.notes || '',
        due: t.due ? String(t.due).slice(0, 10) : null, // Google Tasks due dates have no time
        parent: t.parent || null,
      });
    });
  });
  return { lists: lists.map(function (l) { return l.title; }), items: items };
}

/* ───────────────────────── groceries (a Google Tasks list) ───────────────────────── */

function groceryListId_() {
  const found = taskLists_().filter(isGroceryList_)[0];
  if (found) return found.id;
  const created = Tasks.Tasklists.insert({ title: CONFIG.GROCERY_LIST_NAME });
  LISTS_CACHE_.push(created);
  return created.id;
}

function getGroceries_() {
  return listTasks_(groceryListId_()).map(function (t) {
    return { id: t.id, title: String(t.title).trim() };
  });
}

function addGroceries_(input) {
  let items = Array.isArray(input) ? input : splitItems_(String(input || ''));
  items = items
    .map(function (s) { return String(s).trim().slice(0, 200); })
    .filter(Boolean)
    .slice(0, 30);
  if (!items.length) throw new Error('Nothing to add');

  const listId = groceryListId_();
  const have = {};
  listTasks_(listId).forEach(function (t) { have[String(t.title).trim().toLowerCase()] = true; });

  const fresh = items.filter(function (title) {
    const k = title.toLowerCase();
    if (have[k]) return false;
    have[k] = true;
    return true;
  });
  // New tasks go to the top of the list, so insert in reverse to keep the spoken order.
  fresh.slice().reverse().forEach(function (title) {
    Tasks.Tasks.insert({ title: title }, listId);
  });
}

/** "add milk, eggs and mac and cheese to the grocery list" → ["Milk", "Eggs", "Mac and cheese"] */
function splitItems_(text) {
  const KEEP = /\b(mac(?:aroni)? and cheese|half and half|salt and pepper|sour cream and onion|pork and beans|fish and chips|peanut butter and jelly|chips and salsa)\b/gi;
  let t = String(text || '').trim()
    .replace(/^(?:please\s+)?(?:add|put|get)\s+/i, '')
    .replace(/\s+(?:to|on)\s+(?:the\s+|my\s+|our\s+)?(?:grocery|groceries|shopping)(?:\s+list)?[\s.!]*$/i, '');
  t = t.replace(KEEP, function (m) { return m.replace(/ and /gi, ' \u0001 '); });
  return t.split(/\s*(?:,|;|\n|\band\b|&|\bplus\b)\s*/i)
    .map(function (s) { return s.replace(/\u0001/g, 'and').replace(/[.!?]+$/, '').trim(); })
    .filter(Boolean)
    .map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); });
}

/* ───────────────────────── school lunches ───────────────────────── */

function getLunches_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('LUNCHES') || '{}');
  } catch (err) {
    return {};
  }
}

/** changes = { "2026-11-23": "Pizza", "2026-11-24": "" (empty deletes) } */
function setLunches_(changes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const all = getLunches_();
    Object.keys(changes || {}).forEach(function (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const v = String(changes[date] == null ? '' : changes[date]).trim().slice(0, 120);
      if (v) all[date] = v;
      else delete all[date];
    });
    const cutoff = Utilities.formatDate(new Date(Date.now() - CONFIG.LUNCH_HISTORY_DAYS * 864e5), 'UTC', 'yyyy-MM-dd');
    Object.keys(all).forEach(function (d) { if (d < cutoff) delete all[d]; });
    PropertiesService.getScriptProperties().setProperty('LUNCHES', JSON.stringify(all));
  } finally {
    lock.releaseLock();
  }
}
