const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

if (!process.argv.includes('--child')) {
  for (const zone of ['Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, [__filename, '--child'], {
      env: { ...process.env, TZ: zone },
      stdio: 'inherit',
    });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }
} else {
  void run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function run() {
  // Use only the in-memory store. Never read or write operational booking data.
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.RESERVATION_STORE_FILE = '';
  const NativeDate = Date;
  let clock = '2026-10-01T15:00:00Z';
  class TestDate extends NativeDate {
    constructor(...args) {
      if (args.length === 0) super(clock);
      else super(...args);
    }
    static now() { return new NativeDate(clock).getTime(); }
  }
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, {
      module: mod, exports: mod.exports, Date: TestDate, Buffer, process, globalThis,
      require: (id) => id.startsWith('.')
        ? load(resolve(dirname(file), `${id}.ts`))
        : createRequire(file)(id),
    }, { filename: file });
    return mod.exports;
  }
  const data = load(resolve(__dirname, '../lib/reservation-data.ts'));
  const { applyReservationAction } = load(resolve(__dirname, '../lib/reservation-service.ts'));
  const settings = { bookingWindowDays: 3, maxDurationDays: 5 };
  const emptySnapshot = () => ({
    bookings: [], blockedDates: [], notices: [], changeLogs: [], settings: { ...settings },
  });
  const bookingInput = (startAt, endAt) => ({
    applicant: 'Window Test', channels: ['CH 1'], startAt, endAt, purpose: 'Test',
  });
  const add = (startAt, endAt) => applyReservationAction({
    type: 'addBookings', payload: bookingInput(startAt, endAt),
  }, { isAdmin: false });
  const tests = [];
  const test = (name, fn) => tests.push([name, fn]);

  test('default booking window is three days', () => {
    assert.equal(data.DEFAULT_SETTINGS.bookingWindowDays, 3);
  });
  test('SQL default matches application default without changing existing rules', () => {
    const sql = readFileSync(resolve(__dirname, '../database/schema.sql'), 'utf8');
    assert.match(sql, /booking_window_days integer not null default 3/);
    assert.match(sql, /values \('default', 3, 5\)/);
    assert.match(sql, /on conflict \(id\) do nothing/);
  });
  test('today and the whole third day are allowed, fourth day is blocked', () => {
    for (const start of ['2026-10-02T00:00', '2026-10-03T12:00', '2026-10-04T00:00', '2026-10-04T23:00']) {
      assert.equal(data.isStartWithinBookingWindow(new TestDate(start), settings), true, start);
    }
    for (const start of ['2026-10-01T23:00', '2026-10-05T00:00', '2026-10-05T23:00']) {
      assert.equal(data.isStartWithinBookingWindow(new TestDate(start), settings), false, start);
    }
  });
  test('booking window changes at Korean midnight, regardless of machine timezone', () => {
    for (const [instant, lastDay] of [
      ['2026-09-30T14:59:59Z', '2026-10-02'],
      ['2026-09-30T15:00:00Z', '2026-10-03'],
      ['2026-10-01T15:00:00Z', '2026-10-04'],
      ['2026-10-02T14:59:59Z', '2026-10-04'],
      ['2026-10-02T15:00:00Z', '2026-10-05'],
      ['2026-12-31T15:00:00Z', '2027-01-03'],
    ]) {
      clock = instant;
      assert.equal(data.toDateKey(data.getLatestBookableDate(settings)), lastDay, instant);
      assert.equal(data.isStartWithinBookingWindow(new TestDate(`${lastDay}T23:00`), settings), true);
      assert.equal(data.isStartWithinBookingWindow(data.addDays(new TestDate(`${lastDay}T00:00`), 1), settings), false);
    }
  });
  test('creation allows the last hour ending exactly at the window boundary', async () => {
    const result = await add('2026-10-04T23:00', '2026-10-05T00:00');
    assert.equal(result.ok, true, result.message);
  });
  test('creation rejects an end beyond the open calendar days', async () => {
    const result = await add('2026-10-04T23:00', '2026-10-05T01:00');
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings.length, 0);
  });
  test('end options stop at midnight after the last bookable day', () => {
    const end = data.getLatestAllowedEnd(new TestDate('2026-10-02T12:00'), settings);
    assert.equal(data.toDateTimeLocal(end), '2026-10-05T00:00');
  });
  test('a shorter maximum duration still limits end options', () => {
    const end = data.getLatestAllowedEnd(new TestDate('2026-10-02T12:00'), { ...settings, maxDurationDays: 1 });
    assert.equal(data.toDateTimeLocal(end), '2026-10-03T12:00');
  });
  test('the next day opens only at Korean midnight', async () => {
    clock = '2026-10-02T14:59:59Z';
    assert.equal((await add('2026-10-05T23:00', '2026-10-06T00:00')).ok, false);
    clock = '2026-10-02T15:00:00Z';
    assert.equal((await add('2026-10-05T23:00', '2026-10-06T00:00')).ok, true);
    assert.equal((await add('2026-10-06T00:00', '2026-10-06T01:00')).ok, false);
  });
  test('bookings still require whole-hour increments', async () => {
    const result = await add('2026-10-04T23:00', '2026-10-04T23:30');
    assert.equal(result.ok, false);
  });
  test('creation rejects a fourth-day start without inserting a booking', async () => {
    const result = await add('2026-10-05T00:00', '2026-10-05T01:00');
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings.length, 0);
  });
  test('timezone suffix cannot disguise a fourth-day start', async () => {
    const result = await add('2026-10-05T00:00+09:00', '2026-10-05T01:00+09:00');
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings.length, 0);
  });
  test('editing cannot move a booking to the fourth day', async () => {
    const created = await add('2026-10-03T12:00', '2026-10-03T13:00');
    assert.equal(created.ok, true);
    const result = await applyReservationAction({ type: 'updateBooking', payload: {
      id: created.snapshot.bookings[0].id, requestedBy: 'Window Test', channel: 'CH 1',
      startAt: '2026-10-05T00:00', endAt: '2026-10-05T01:00', purpose: 'Test',
    } }, { isAdmin: false });
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings[0].startAt, '2026-10-03T12:00');
  });
  async function recover(startAt, endAt) {
    const legacy = emptySnapshot();
    legacy.bookings.push({
      id: 'legacy-window-test', applicant: 'Legacy Test', channel: 'CH 2',
      startAt, endAt, purpose: '', status: 'active', createdAt: clock,
    });
    return applyReservationAction({ type: 'recoverLegacySnapshot', payload: { snapshot: legacy } }, { isAdmin: false });
  }
  test('editing cannot extend into an unopened calendar day', async () => {
    const created = await add('2026-10-04T23:00', '2026-10-05T00:00');
    assert.equal(created.ok, true);
    const result = await applyReservationAction({ type: 'updateBooking', payload: {
      id: created.snapshot.bookings[0].id, requestedBy: 'Window Test', channel: 'CH 1',
      startAt: '2026-10-04T23:00', endAt: '2026-10-05T01:00', purpose: 'Test',
    } }, { isAdmin: false });
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings[0].endAt, '2026-10-05T00:00');
  });
  test('legacy recovery cannot create a fourth-day booking', async () => {
    const result = await recover('2026-10-05T00:00', '2026-10-05T01:00');
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings.length, 0);
  });
  test('legacy recovery still restores recent historical records', async () => {
    const result = await recover('2026-09-30T12:00', '2026-09-30T13:00');
    assert.equal(result.ok, true, result.message);
    assert.equal(result.snapshot.bookings.length, 1);
  });
  test('legacy recovery cannot extend beyond the booking window', async () => {
    const result = await recover('2026-10-04T23:00', '2026-10-05T01:00');
    assert.equal(result.ok, false);
    assert.equal(result.snapshot.bookings.length, 0);
  });
  test('legacy recovery allows an end exactly at the boundary', async () => {
    const result = await recover('2026-10-04T23:00', '2026-10-05T00:00');
    assert.equal(result.ok, true, result.message);
  });
  test('saved admin window remains configurable', () => {
    assert.equal(data.isStartWithinBookingWindow(new TestDate('2026-10-05T12:00'), { ...settings, bookingWindowDays: 4 }), true);
    assert.equal(data.isStartWithinBookingWindow(new TestDate('2026-10-06T00:00'), { ...settings, bookingWindowDays: 4 }), false);
  });
  test('one bookable day means only today, with compatibility for saved zero', () => {
    for (const bookingWindowDays of [0, 1]) {
      const rule = { ...settings, bookingWindowDays };
      assert.equal(data.isStartWithinBookingWindow(new TestDate('2026-10-02T23:00'), rule), true);
      assert.equal(data.isStartWithinBookingWindow(new TestDate('2026-10-03T00:00'), rule), false);
    }
  });
  test('admin must save a positive whole number of bookable days', async () => {
    for (const bookingWindowDays of [0, -1, 1.5]) {
      const result = await applyReservationAction({ type: 'updateSettings', payload: {
        ...settings, bookingWindowDays,
      } }, { isAdmin: true });
      assert.equal(result.ok, false, String(bookingWindowDays));
    }
  });
  test('new limits do not delete existing bookings beyond the window', async () => {
    globalThis.__potentiostatReservationSnapshot.bookings.push({
      id: 'existing-future', applicant: 'Existing', channel: 'CH 2',
      startAt: '2026-10-06T10:00', endAt: '2026-10-06T11:00',
      status: 'active', purpose: '', createdAt: clock,
    });
    const result = await add('2026-10-04T23:00', '2026-10-05T00:00');
    assert.equal(result.ok, true);
    assert.equal(result.snapshot.bookings.some((booking) => booking.id === 'existing-future'), true);
  });

  let failures = 0;
  for (const [name, fn] of tests) {
    clock = '2026-10-01T15:00:00Z';
    globalThis.__potentiostatReservationSnapshot = emptySnapshot();
    try { await fn(); }
    catch (error) { failures++; console.error(`FAIL (${process.env.TZ}): ${name}\n${error.message}`); }
  }
  console.log(`${process.env.TZ}: ${tests.length - failures}/${tests.length} booking-window checks passed.`);
  if (failures) process.exitCode = 1;
}
