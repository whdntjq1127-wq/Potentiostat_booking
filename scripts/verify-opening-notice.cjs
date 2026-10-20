const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
let reservationFixture;
let testLanguage = 'en';
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: mod, exports: mod.exports, Date,
    require: (id) => {
      if (id.endsWith('/reservation-context')) return { useReservation: () => reservationFixture };
      if (id.endsWith('/language-context')) return { useLanguage: () => ({ language: testLanguage, copy: translations[testLanguage] }) };
      if (id.endsWith('/use-booking-queue')) return { useBookingQueue: () => ({ ready: true, status: { enabled: true, state: 'idle' }, canBook: false }) };
      if (!id.startsWith('.')) return createRequire(file)(id);
      const path = resolve(dirname(file), id);
      return load(existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`);
    },
  }, { filename: file });
  return mod.exports;
}
const { translations } = load(resolve(__dirname, '../lib/i18n.ts'));
assert.ok(translations.en.openingNotice && translations.ko.openingNotice, 'Homepage needs bilingual opening-rule copy');
const { BookingOpeningNotice } = load(resolve(__dirname, '../components/booking-opening-notice.tsx'));
for (const language of ['en', 'ko']) {
  const copy = translations[language].openingNotice;
  const render = settings => renderToStaticMarkup(React.createElement(BookingOpeningNotice, { language, settings }));
  for (const [window, target, offset] of [[3, 23, 2], [4, 24, 3], [1, 21, 0], [0, 21, 0]]) {
    const html = render({ bookingWindowDays: window, maxDurationDays: 5 });
    assert.ok(html.includes(copy.headline(offset)));
    assert.match(html, /KST/);
    assert.match(html, /10\/21/);
    assert.ok(html.includes(`10/${target}`));
    assert.ok(html.includes(`10/${target + 1}`));
    assert.match(html, /00:00/);
    assert.doesNotMatch(html, /Invalid Date|NaN/);
  }
  const loading = render(null);
  assert.ok(loading.includes(copy.loading));
  assert.doesNotMatch(loading, /10\/21/);
  const failed = renderToStaticMarkup(React.createElement(BookingOpeningNotice, {
    language, settings: { bookingWindowDays: 3, maxDurationDays: 5 }, unavailable: true,
  }));
  assert.ok(copy.unavailable && failed.includes(copy.unavailable), 'Failed settings must show an error, not default rules');
  assert.doesNotMatch(failed, /10\/21/);
}
const Home = load(resolve(__dirname, '../app/page.tsx')).default;
for (const language of ['en', 'ko']) {
  testLanguage = language;
  reservationFixture = {
    ready: true, error: 'Test network failure', bookings: [], blockedDates: [], notices: [],
    settings: { bookingWindowDays: 3, maxDurationDays: 5 },
  };
  const failedHome = renderToStaticMarkup(React.createElement(Home));
  assert.ok(failedHome.includes(translations[language].openingNotice.unavailable));
  assert.doesNotMatch(failedHome, /10\/21/);
}
console.log('PASS: bilingual opening notices, actual settings, example end boundary, loading and failed-fetch homepage');
