const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

async function run() {
  const calls = [];
  let finishPoll;
  const mod = { exports: {} };
  const status = { enabled: true, state: 'idle', serverNow: new Date().toISOString(), expiresAt: null };
  vm.runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../components/use-booking-queue.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module: mod, exports: mod.exports, Date, performance, AbortSignal,
    require: () => ({ useState: (value) => [value, () => {}], useRef: (value) => ({ current: value }), useEffect: () => {} }),
    fetch: async (_url, init) => {
      const op = JSON.parse(init.body).operation;
      calls.push(op);
      if (op === 'status') await new Promise((resolvePoll) => { finishPoll = resolvePoll; });
      return { ok: true, json: async () => ({ ...status, state: op === 'join' ? 'active' : 'idle' }) };
    },
  });
  const queue = mod.exports.useBookingQueue();
  const poll = queue.refresh();
  const join = queue.join();
  assert.equal(calls.length, 1, 'Join waits for the existing poll');
  finishPoll();
  await poll;
  assert.equal((await join)?.state, 'active', 'Click during polling must not be discarded');
  assert.deepEqual(calls, ['status', 'join']);
  for (const [state, remaining, expected] of [['idle', 0, false], ['active', 120, true], ['active', 0, false], ['expired', 0, false]]) {
    const testMod = { exports: {} };
    let index = 0;
    const values = [{ ...status, enabled: false, state }, false, false, remaining];
    vm.runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../components/use-booking-queue.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      module: testMod, exports: testMod.exports, Date, performance, AbortSignal,
      require: () => ({ useState: (value) => [index < values.length ? values[index++] : value, () => {}],
        useRef: (value) => ({ current: value }), useEffect: () => {} }),
    });
    assert.equal(testMod.exports.useBookingQueue().canBook, expected, `Disabled queue: ${state}/${remaining}`);
  }
  const mountMod = { exports: {} };
  const effects = [];
  const mountCalls = [];
  vm.runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../components/use-booking-queue.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module: mountMod, exports: mountMod.exports, Date, performance, AbortSignal,
    setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
    window: { addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    require: () => ({ useState: (value) => [value, () => {}], useRef: (value) => ({ current: value }),
      useEffect: (effect) => effects.push(effect) }),
    fetch: async (_url, init) => {
      mountCalls.push(JSON.parse(init.body).operation);
      return { ok: true, json: async () => status };
    },
  });
  assert.equal(mountMod.exports.useBookingQueue({ resetOnMount: true }).ready, false);
  const cleanup = effects[0]();
  await new Promise((done) => setImmediate(done));
  assert.deepEqual(mountCalls, ['leave'], 'Home mount releases the previous turn without auto-joining');
  cleanup();
  console.log('PASS: click during polling, timed disabled mode and release-on-mount');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
