const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

if (!process.argv.includes('--child')) {
  for (const zone of ['Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, [__filename, '--child'], {
      env: { ...process.env, TZ: zone }, stdio: 'inherit',
    });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }
} else {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(code, {
      module: mod, exports: mod.exports, Date,
      require: (id) => id.startsWith('.') ? load(resolve(dirname(file), `${id}.ts`)) : createRequire(file)(id),
    }, { filename: file });
    return mod.exports;
  }
  const { translations } = load(resolve(__dirname, '../lib/i18n.ts'));
  assert.ok(translations.en.adminRules && translations.ko.adminRules,
    'Admin rules need bilingual explanations for the current booking flow');
  const { AdminBookingRuleFields } = load(resolve(__dirname, '../components/admin-booking-rule-fields.tsx'));
  const settings = { bookingWindowDays: 3, maxDurationDays: 2 };
  const render = (language, now, draft = settings) => renderToStaticMarkup(React.createElement(AdminBookingRuleFields, {
    language, now: now ? new Date(now) : null, settings: draft, onChange: () => {}, disabled: false,
  }));
  let checks = 0;
  for (const language of ['en', 'ko']) {
    const copy = translations[language].adminRules;
    const html = render(language, '2026-10-01T15:00:00Z');
    for (const text of [copy.windowLabel, copy.durationLabel, copy.queueNote, copy.flow, copy.previewTitle, copy.previewHint]) {
      assert.ok(html.includes(text), text);
      checks++;
    }
    assert.match(html, /id="booking-window"[^>]*min="1"[^>]*step="1"[^>]*required=""/);
    assert.match(html, /id="max-duration"[^>]*min="1"[^>]*step="1"[^>]*required=""/);
    assert.match(html, /2026-10-02/);
    assert.match(html, /2026-10-04/);
    assert.match(html, /2026-10-05 00:00/);
    assert.match(html, /2026-10-03 00:00/);
    assert.match(html, /48/);
    checks += 7;
    for (const draft of [{ ...settings, bookingWindowDays: 0 }, { ...settings, bookingWindowDays: 1.5 },
      { ...settings, maxDurationDays: -1 }, { ...settings, maxDurationDays: NaN }]) {
      const invalid = render(language, '2026-10-01T15:00:00Z', draft);
      assert.ok(invalid.includes(copy.invalidDraft));
      assert.doesNotMatch(invalid, /2026-10-05|Invalid Date/);
      checks++;
    }
  }
  for (const [now, end] of [
    ['2026-10-02T14:59:59Z', '2026-10-05 00:00'],
    ['2026-10-02T15:00:00Z', '2026-10-06 00:00'],
    ['2026-12-31T15:00:00Z', '2027-01-04 00:00'],
    ['2028-02-27T15:00:00Z', '2028-03-02 00:00'],
  ]) {
    assert.ok(render('en', now).includes(end), `${now} -> ${end}`);
    checks++;
  }
  assert.ok(render('en', '2026-10-01T15:00:00Z', { ...settings, bookingWindowDays: 1 }).includes('2026-10-03 00:00'));
  assert.ok(render('en', '2026-10-01T15:00:00Z', { ...settings, bookingWindowDays: 4 }).includes('2026-10-06 00:00'));
  assert.doesNotMatch(render('en', null), /Invalid Date|2026-10-05/);
  checks += 3;
  console.log(`${process.env.TZ}: ${checks} admin-rules rendering checks passed.`);
}
