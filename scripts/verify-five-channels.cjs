const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.RESERVATION_STORE_FILE = '';
process.env.RESERVATION_QUEUE_ENABLED = 'false';
const channels = ['CH 1', 'CH 2', 'CH 3', 'CH 4', 'CH 5'];
const settings = { bookingWindowDays: 3, maxDurationDays: 5 };
const empty = () => ({ bookings: [], changeLogs: [], notices: [], blockedDates: [], settings: { ...settings } });
let language = 'en';
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: mod, exports: mod.exports, Date, Buffer, process, globalThis,
    require: (id) => {
      if (id === './reservation-context') return { useReservation: () => ({ ...empty(), addBooking: () => {} }) };
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

async function run() {
  const data = load(resolve(__dirname, '../lib/reservation-data.ts'));
  assert.deepEqual(Array.from(data.CHANNELS), channels, 'Expose exactly CH 1 through CH 5');
  assert.equal(data.getSlotRows().length, 24 * 5);
  for (const channel of channels) {
    assert.match(data.getChannelColor(channel), /^#[0-9a-f]{6}$/i);
    assert.match(data.getChannelSoftColor(channel), /^#[0-9a-f]{6}$/i);
  }
  assert.equal(new Set(channels.map(data.getChannelColor)).size, 5);
  assert.equal(new Set(channels.map(data.getChannelSoftColor)).size, 5);
  const { WeeklySchedule } = load(resolve(__dirname, '../components/weekly-schedule.tsx'));
  const { BookingForm } = load(resolve(__dirname, '../components/booking-form.tsx'));
  for (language of ['en', 'ko']) {
    const now = new Date('2026-10-20T12:00:00+09:00');
    const html = renderToStaticMarkup(React.createElement(WeeklySchedule, {
      anchorDate: now, now, selectedSlot: null, onSelectSlot() {}, onShiftWeek() {},
    }));
    assert.equal((html.match(/colSpan="5"/gi) || []).length, 7, 'Each day groups five channel columns');
    assert.equal((html.match(/class="channel-subhead/g) || []).length, 7 * 5);
    assert.equal((html.match(/class="slot-cell/g) || []).length, 7 * 5 * 24);
    assert.equal((html.match(/class="slot-cell date-end-cell"/g) || []).length, 7 * 24);
    const copy = load(resolve(__dirname, '../lib/i18n.ts')).translations[language];
    assert.match(copy.site.brandSubtitle, /CH 5/, 'Both languages describe all five channels');
  }
  const form = renderToStaticMarkup(React.createElement(BookingForm, { title: 'Test', description: 'Test' }));
  for (const channel of channels) assert.ok(form.includes(`value="${channel}"`));

  const { applyReservationAction } = load(resolve(__dirname, '../lib/reservation-service.ts'));
  const startAt = data.toDateTimeLocal(data.setHour(data.getBookingToday(), 9));
  const endAt = data.toDateTimeLocal(data.setHour(data.getBookingToday(), 10));
  const add = (selected) => applyReservationAction({ type: 'addBookings', payload: {
    applicant: 'Five Channel Test', channels: selected, startAt, endAt, purpose: '',
  } }, { isAdmin: false });
  globalThis.__potentiostatReservationSnapshot = empty();
  let result = await add(channels);
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.bookings.length, 5);
  assert.equal(result.snapshot.changeLogs.length, 5);
  for (const invalid of [['CH 6'], ['CH 4', 'CH 6'], [], null, 'CH 4']) {
    assert.equal((await add(invalid)).ok, false, 'Invalid channels must be rejected before storage');
  }

  globalThis.__potentiostatReservationSnapshot = empty();
  assert.equal((await add(['CH 4'])).ok, true);
  result = await add(['CH 4', 'CH 5']);
  assert.equal(result.ok, false, 'One conflicting channel rejects the entire multi-channel request');
  assert.equal(result.snapshot.bookings.length, 1);
  assert.equal((await add(['CH 5'])).ok, true, 'CH 4 and CH 5 can be booked independently at the same time');
  const id = globalThis.__potentiostatReservationSnapshot.bookings.find((b) => b.channel === 'CH 4').id;
  const edit = (channel, start = startAt, end = endAt) => applyReservationAction({ type: 'updateBooking', payload: {
    id, requestedBy: 'Test', channel, startAt: start, endAt: end, purpose: '',
  } }, { isAdmin: false });
  assert.equal((await edit('CH 6')).ok, false);
  assert.equal((await edit('CH 5')).ok, false, 'Editing into an occupied CH 5 is rejected');
  result = await edit('CH 5', endAt, data.toDateTimeLocal(data.setHour(data.getBookingToday(), 11)));
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.bookings.find((b) => b.id === id).channel, 'CH 5');
  result = await applyReservationAction({ type: 'cancelBooking', payload: { id, requestedBy: 'Test' } }, { isAdmin: false });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.bookings.find((b) => b.id === id).status, 'cancelled');
  console.log('PASS: five-channel calendar/forms/colors/translations, create/edit/cancel, independent conflicts and validation');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
