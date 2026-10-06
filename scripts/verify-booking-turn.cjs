const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = resolve(__dirname, '../lib/booking-turn.ts');
assert.ok(existsSync(file), 'Queue-disabled bookings need a server-verified two-minute turn');
const mod = { exports: {} };
const env = { ADMIN_SESSION_SECRET: 'isolated-turn-unit-test' };
vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: mod, exports: mod.exports, require, Date, Buffer, process: { env } });
const { createBookingTurn, readBookingTurn } = mod.exports;
const now = Date.parse('2026-10-06T03:00:00Z');
const token = createBookingTurn(now);
assert.equal(readBookingTurn(token, now).expiresAt, now + 120000);
assert.equal(readBookingTurn(token, now + 119999).state, 'active');
assert.equal(readBookingTurn(token, now + 120000).state, 'expired');
assert.equal(readBookingTurn(token, now + 120001).state, 'expired');
assert.equal(readBookingTurn(token, now + 30000).expiresAt, now + 120000);
assert.equal(readBookingTurn(undefined, now), null);
assert.equal(readBookingTurn('invalid', now), null);
assert.equal(readBookingTurn(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), now), null);
assert.equal(readBookingTurn(token.replace(String(now), String(now + 60000)), now), null);
assert.equal(readBookingTurn(token, now - 1), null);
env.ADMIN_SESSION_SECRET = 'different-test-secret';
assert.equal(readBookingTurn(token, now), null);
console.log('PASS: signed booking turn, exact 120-second expiry, tampering and clock boundaries');
