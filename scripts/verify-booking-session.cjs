const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

// Run the real Home event handlers with deterministic hooks and isolated service responses.
const hooks = [];
let cursor = 0, changed = false, effects = [];
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  ...React,
  useState(initial) {
    const i = cursor++;
    if (!hooks[i]) hooks[i] = { value: typeof initial === 'function' ? initial() : initial };
    return [hooks[i].value, value => {
      const next = typeof value === 'function' ? value(hooks[i].value) : value;
      if (!Object.is(next, hooks[i].value)) { hooks[i].value = next; changed = true; }
    }];
  },
  useMemo(fn, deps) {
    const i = cursor++;
    if (!same(hooks[i]?.deps, deps)) hooks[i] = { deps, value: fn() };
    return hooks[i].value;
  },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!same(hooks[i]?.deps, deps)) { hooks[i] = { deps }; effects.push(fn); }
  },
};
const admittedAt = Date.parse('2026-10-20T09:00:00+09:00');
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [admittedAt])); }
  static now() { return admittedAt; }
}
const expiry = new Date(admittedAt + 120000).toISOString();
let joins = 0, leaves = 0, saveOK = true;
const saved = [];
const queue = {
  ready: true, canBook: false, busy: false, remaining: 0, status: { enabled: true, state: 'idle' },
  async join() { joins++; this.canBook = true; this.remaining = 120; this.status = { enabled: true, state: 'active', expiresAt: expiry }; },
  async leave() { leaves++; this.canBook = false; this.status = { enabled: true, state: 'idle' }; },
  async refresh() { return this.status; },
};
const reservation = {
  ready: true, error: null, bookings: [], notices: [], blockedDates: [],
  settings: { bookingWindowDays: 3, maxDurationDays: 5 },
  async refresh() {},
  async addBookings(input) { if (saveOK) saved.push(input); return { ok: saveOK, message: saveOK ? 'Saved' : 'Conflict' }; },
};
function WeeklySchedule() {}
let translations;
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const noop = () => {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: mod, exports: mod.exports, Date: TestDate,
    window: { setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop, addEventListener: noop, removeEventListener: noop },
    document: { addEventListener: noop, removeEventListener: noop }, sessionStorage: { removeItem: noop },
    require(id) {
      if (id === 'react') return react;
      if (id.endsWith('/reservation-context')) return { useReservation: () => reservation };
      if (id.endsWith('/language-context')) return { useLanguage: () => ({ language: 'en', copy: translations.en }) };
      if (id.endsWith('/use-booking-queue')) return { useBookingQueue: () => queue };
      if (id.endsWith('/weekly-schedule')) return { WeeklySchedule };
      if (!id.startsWith('.')) return createRequire(file)(id);
      const path = resolve(dirname(file), id);
      return load(existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`);
    },
  }, { filename: file });
  return mod.exports;
}
translations = load(resolve(__dirname, '../lib/i18n.ts')).translations;
const Home = load(resolve(__dirname, '../app/page.tsx')).default;
function render() {
  for (let i = 0; i < 20; i++) {
    cursor = 0; changed = false; effects = [];
    const tree = Home();
    effects.forEach(fn => fn());
    if (!changed) return tree;
  }
  throw new Error('Home failed to settle');
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const calendar = tree => find(tree, n => n.type === WeeklySchedule);
const form = tree => find(tree, n => n.type === 'form');
function select(tree, start = '10:00') {
  calendar(tree).props.onSelectSlot({ date: '2026-10-21', channel: 'CH 4', channels: ['CH 4'],
    startAt: `2026-10-21T${start}`, endAt: '2026-10-21T12:00' });
  tree = render();
  find(tree, n => n.props?.id === 'modal-applicant').props.onChange({ target: { value: 'Session Test' } });
  return render();
}
async function run() {
  let tree = render();
  find(tree, n => n.props?.className === 'booking-start-button').props.onClick();
  await Promise.resolve();
  tree = select(render());
  await form(tree).props.onSubmit({ preventDefault() {} });
  tree = render();
  assert.ok(calendar(tree), 'Successful save keeps the admitted calendar open');
  assert.equal(form(tree), undefined, 'Successful save closes only the completed form');
  assert.equal(queue.status.expiresAt, expiry);
  queue.remaining = 73;
  tree = select(tree, '11:00');
  await form(tree).props.onSubmit({ preventDefault() {} });
  tree = render();
  assert.ok(calendar(tree));
  assert.equal(saved.length, 2);
  assert.equal(joins, 1, 'Additional saves never rejoin or reset the admission');
  assert.equal(leaves, 0);
  assert.equal(queue.remaining, 73);
  assert.equal(queue.status.expiresAt, expiry);
  saveOK = false;
  tree = select(tree);
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.ok(form(render()), 'A conflict keeps the form open for correction');
  queue.remaining = 0; queue.canBook = false; queue.status = { ...queue.status, state: 'expired' };
  tree = render();
  assert.equal(calendar(tree), undefined);
  assert.equal(form(tree), undefined);
  assert.ok(find(tree, n => n.props?.className === 'booking-start-button'));
  assert.equal(leaves, 1, 'Original deadline still returns to entry and releases admission');
  console.log('PASS: Home repeat saves, form reset, no rejoin/extension, conflict and expiry return');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
