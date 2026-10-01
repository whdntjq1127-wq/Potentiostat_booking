const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.RESERVATION_STORE_FILE = '';
process.env.RESERVATION_QUEUE_ENABLED = 'true';
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module: mod, exports: mod.exports, Date, Buffer, process, globalThis,
    require: (id) => id.startsWith('.') ? load(resolve(dirname(file), `${id}.ts`)) : createRequire(file)(id),
  }, { filename: file });
  return mod.exports;
}

async function run() {
  const data = load(resolve(__dirname, '../lib/reservation-data.ts'));
  const { applyReservationAction } = load(resolve(__dirname, '../lib/reservation-service.ts'));
  globalThis.__potentiostatReservationSnapshot = {
    bookings: [], changeLogs: [], notices: [], blockedDates: [],
    settings: { bookingWindowDays: 3, maxDurationDays: 5 },
  };
  const start = data.getBookingToday();
  const action = { type: 'addBookings', payload: {
    applicant: 'Queue test', channels: ['CH 1'], purpose: '',
    startAt: data.toDateTimeLocal(start), endAt: data.toDateTimeLocal(data.addHours(start, 1)),
  } };
  const denied = await applyReservationAction(action, { isAdmin: false });
  assert.equal(denied.ok, false, 'Queue mode must reject a booking without a turn');
  assert.equal(globalThis.__potentiostatReservationSnapshot.bookings.length, 0);
  const recovery = await applyReservationAction({ type: 'recoverLegacySnapshot', payload: {
    snapshot: globalThis.__potentiostatReservationSnapshot,
  } }, { isAdmin: true });
  assert.equal(recovery.ok, false, 'Snapshot replacement must not bypass queue transactions');
  process.env.RESERVATION_QUEUE_ENABLED = 'false';
  const normal = await applyReservationAction(action, { isAdmin: false });
  assert.equal(normal.ok, true, 'Disabled mode preserves existing booking behavior');
  console.log('PASS: queue gate, recovery gate, disabled-mode compatibility');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
