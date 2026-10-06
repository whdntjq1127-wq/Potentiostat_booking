const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

for (const language of ['en', 'ko']) {
  const file = resolve(__dirname, '../components/booking-queue-panel.tsx');
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: mod, exports: mod.exports,
    require: (id) => id === './language-context' ? { useLanguage: () => ({ language }) } : createRequire(file)(id),
  });
  const { BookingQueuePanel, QueueTimer, queueCopy } = mod.exports;
  const queue = { status: { enabled: true, state: 'waiting', position: 1, ahead: 0 }, remaining: 120,
    busy: false, error: false, join: () => {} };
  const html = renderToStaticMarkup(React.createElement(BookingQueuePanel, { queue, onClose: () => {} }));
  assert.match(queueCopy[language].note, /3/, 'Both languages explain the three-person capacity');
  assert.ok(html.includes(queueCopy[language].note));
  assert.ok(html.includes(queueCopy[language].position));
  assert.match(html, /<strong>01<\/strong>/);
  assert.match(html, /<strong>0<\/strong>/);
  assert.doesNotMatch(html, /One person at a time|한 번에 한 명씩/);
  const timer = renderToStaticMarkup(React.createElement(QueueTimer, {
    queue: { ...queue, status: { ...queue.status, state: 'active' } },
  }));
  assert.match(timer, /02:00/);
}
console.log('PASS: English/Korean three-person copy, waiting-only positions and two-minute timer');
