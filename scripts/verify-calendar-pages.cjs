const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const cache = new Map();
let language = 'en';
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: mod, exports: mod.exports, Date,
    require: (id) => {
      if (id === './reservation-context') return { useReservation: () => ({
        bookings: [], blockedDates: [], settings: { bookingWindowDays: 3, maxDurationDays: 5 },
      }) };
      if (id === './language-context') return { useLanguage: () => ({
        language, copy: load(resolve(__dirname, '../lib/i18n.ts')).translations[language],
      }) };
      if (!id.startsWith('.')) return createRequire(file)(id);
      const path = resolve(dirname(file), id);
      return load(existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`);
    },
  }, { filename: file });
  return mod.exports;
}

const data = load(resolve(__dirname, '../lib/reservation-data.ts'));
assert.equal(typeof data.getSchedulePageDates, 'function', 'Calendar needs Monday-Friday / Saturday-Sunday date groups');
for (const [anchor, monday, sunday] of [
  ['2026-10-19', '2026-10-19', '2026-10-25'],
  ['2026-10-24', '2026-10-19', '2026-10-25'],
  ['2026-10-25', '2026-10-19', '2026-10-25'],
  ['2026-11-01', '2026-10-26', '2026-11-01'],
  ['2027-01-01', '2026-12-28', '2027-01-03'],
]) {
  const start = new Date(`${anchor}T12:00`);
  const weekdays = data.getSchedulePageDates(start, 'weekdays');
  const weekend = data.getSchedulePageDates(start, 'weekend');
  assert.deepEqual(Array.from(weekdays, date => date.getDay()), [1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(weekend, date => date.getDay()), [6, 0]);
  assert.equal(data.toDateKey(weekdays[0]), monday);
  assert.equal(data.toDateKey(weekend[1]), sunday);
  assert.equal(new Set([...weekdays, ...weekend].map(data.toDateKey)).size, 7);
  assert.equal(data.toDateKey(start), anchor, 'Date helpers must not mutate the anchor');
}
const { WeeklySchedule } = load(resolve(__dirname, '../components/weekly-schedule.tsx'));
for (language of ['ko', 'en']) {
  const now = new Date('2026-10-20T12:00');
  const html = renderToStaticMarkup(React.createElement(WeeklySchedule, {
    anchorDate: now, now, selectedSlot: null, onSelectSlot() {}, onShiftWeek() {},
  }));
  const copy = load(resolve(__dirname, '../lib/i18n.ts')).translations[language].schedule;
  assert.equal((html.match(/colSpan="5"/gi) || []).length, 5);
  assert.equal((html.match(/class="channel-subhead/g) || []).length, 25);
  assert.equal((html.match(/class="slot-cell/g) || []).length, 600);
  assert.ok(html.includes(copy.weekdays));
  assert.ok(html.includes(copy.showWeekend));
  assert.ok(html.includes(copy.previousWeek) && html.includes(copy.nextWeek), 'Week history remains accessible');
  assert.doesNotMatch(html, /--schedule-min-width/);
}
// Exercise the component's event handlers with a minimal hook host between renders.
const state = [];
let cursor = 0;
let fixtureBookings = [];
const selected = [];
const cancelled = [];
const shifted = [];
const hookModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../components/weekly-schedule.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  module: hookModule, exports: hookModule.exports, Date,
  window: { setTimeout: callback => { callback(); } },
  require: id => {
    if (id === 'react') return {
      ...React,
      useState: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useRef: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
      useEffect() {},
      useMemo: factory => factory(),
    };
    if (id === './reservation-context') return { useReservation: () => ({
      bookings: fixtureBookings, blockedDates: [], settings: { bookingWindowDays: 7, maxDurationDays: 5 },
    }) };
    if (id === './language-context') return { useLanguage: () => ({
      language: 'en', copy: load(resolve(__dirname, '../lib/i18n.ts')).translations.en,
    }) };
    if (id.startsWith('../lib/')) return load(resolve(__dirname, `../lib/${id.split('/').at(-1)}.ts`));
    return require(id);
  },
});
function renderTree() {
  cursor = 0;
  return hookModule.exports.WeeklySchedule({
    anchorDate: new Date('2026-10-20T12:00'), now: new Date('2026-10-20T12:00'),
    selectedSlot: null, onSelectSlot: slot => selected.push(slot),
    onCancelBooking: booking => cancelled.push(booking), onShiftWeek: direction => shifted.push(direction),
  });
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const button = (tree, name) => nodes(tree).find(node => node.type === 'button' &&
  (node.props['aria-label'] === name || node.props.children === name));
const slot = (tree, date, hour, channel) => nodes(tree).find(node => node.type === 'button' &&
  node.props['aria-label']?.includes(`${date}`) && node.props['aria-label']?.endsWith(`${hour}:00 ${channel}`));
const pointer = { button: 0, buttons: 1, preventDefault() {} };
let tree = renderTree();
assert.equal(button(tree, 'Show weekdays').props.disabled, true);
slot(tree, '10/22', '09', 'CH 4').props.onPointerDown(pointer);
tree = renderTree();
button(tree, 'Show weekend').props.onClick();
tree = renderTree();
assert.equal(nodes(tree).filter(node => node.type === 'th' && node.props.colSpan === 5).length, 2);
assert.equal(button(tree, 'Show weekend').props.disabled, true);
slot(tree, '10/24', '09', 'CH 5').props.onPointerUp(pointer);
assert.equal(selected.length, 0, 'Changing pages cancels an unfinished drag');
slot(tree, '10/25', '09', 'CH 5').props.onClick();
assert.equal(selected[0].startAt, '2026-10-25T09:00');
assert.equal(selected[0].endAt, '2026-10-25T10:00');
slot(tree, '10/24', '13', 'CH 4').props.onPointerDown(pointer);
tree = renderTree();
slot(tree, '10/24', '14', 'CH 5').props.onPointerEnter(pointer);
tree = renderTree();
slot(tree, '10/24', '14', 'CH 5').props.onPointerUp(pointer);
assert.deepEqual(Array.from(selected[1].channels), ['CH 4', 'CH 5']);
assert.equal(selected[1].startAt, '2026-10-24T13:00');
assert.equal(selected[1].endAt, '2026-10-24T15:00');
fixtureBookings = [{
  id: 'existing', applicant: 'Existing weekend booking', channel: 'CH 5', status: 'active',
  startAt: '2026-10-25T09:00', endAt: '2026-10-25T10:00', purpose: '', createdAt: '2026-10-20T00:00',
}];
tree = renderTree();
button(tree, 'Existing weekend booking').props.onClick();
assert.equal(cancelled[0].id, 'existing', 'Existing weekend bookings remain actionable');
button(tree, 'Next Week').props.onClick();
tree = renderTree();
assert.deepEqual(shifted, [1]);
assert.equal(button(tree, 'Show weekdays').props.disabled, true);
assert.equal(nodes(tree).filter(node => node.type === 'th' && node.props.colSpan === 5).length, 5);
const styles = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
const noticeStyles = styles.match(/\.calendar-notice-panel\s*\{([^}]+)\}/)[1];
assert.match(noticeStyles, /flex:\s*0 0 auto/, 'Admin notices must size to content in the vertical calendar panel');
console.log('PASS: Monday-first dates/boundaries, bilingual pages, switching, CH4/CH5 drag, cancellation, week navigation and compact notices');
