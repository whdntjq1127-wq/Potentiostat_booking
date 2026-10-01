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
  console.log('PASS: booking click waits for polling instead of being lost');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
