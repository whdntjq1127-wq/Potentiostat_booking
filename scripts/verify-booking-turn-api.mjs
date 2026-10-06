import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const temp = await mkdtemp(join(tmpdir(), 'potentiostat-turn-'));
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const base = `http://127.0.0.1:${port}`;
const secret = 'isolated-turn-api-test';
const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
    RESERVATION_QUEUE_ENABLED: 'false', RESERVATION_STORE_FILE: join(temp, 'reservations.json'),
    ADMIN_SESSION_SECRET: secret, ADMIN_PASSWORD: 'isolated-turn-admin' },
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk; });
child.stderr.on('data', (chunk) => { logs += chunk; });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let cookie = '';
async function post(path, body, override) {
  const res = await fetch(base + path, { method: 'POST', headers: {
    'Content-Type': 'application/json', Origin: base, Cookie: override ?? cookie,
  }, body: JSON.stringify(body) });
  if (override === undefined && res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  return { status: res.status, data: await res.json(), setCookie: res.headers.get('set-cookie') };
}
const queue = (operation, override) => post('/api/reservations/queue', { operation }, override);
function signedCookie(issuedAt) {
  const payload = `${issuedAt}.${randomBytes(32).toString('hex')}`;
  const signature = createHmac('sha256', secret).update(`potentiostat:booking-turn:v1:${payload}`).digest('hex');
  return `pb_booking_turn=${payload}.${signature}`;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base + '/api/reservations')).ok) { ready = true; break; } } catch { /* Starting. */ }
    await sleep(200);
  }
  assert.ok(ready, logs);
  if (process.argv.includes('--serve')) {
    console.log(`UI_URL=${base}`);
    await new Promise((done) => { process.once('SIGINT', done); process.once('SIGTERM', done); });
  } else {
    assert.equal((await queue('status')).data.state, 'idle');
    const first = await queue('join');
    assert.equal(first.data.state, 'active', 'Queue-disabled entry must still start a timed booking turn');
    assert.equal(first.data.enabled, false);
    assert.equal(Date.parse(first.data.expiresAt) - Date.parse(first.data.serverNow), 120000);
    assert.match(first.setCookie, /HttpOnly/);
    assert.match(first.setCookie, /SameSite=lax/i);
    assert.equal((await queue('status')).data.expiresAt, first.data.expiresAt);
    assert.equal((await queue('join')).data.expiresAt, first.data.expiresAt, 'Repeated entry cannot extend an active turn');
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const booking = { type: 'addBookings', payload: { applicant: 'Turn API Test', channels: ['CH 3'],
      startAt: `${day}T01:00`, endAt: `${day}T02:00`, purpose: '' } };
    for (const invalid of ['', 'pb_booking_turn=tampered', signedCookie(Date.now() - 120001)]) {
      assert.equal((await post('/api/reservations/actions', booking, invalid)).status, 403);
      assert.equal((await post('/api/reservations/actions', { type: 'updateBooking', payload: {} }, invalid)).status, 403);
    }
    assert.equal((await queue('status', signedCookie(Date.now() - 120001))).data.state, 'expired');
    assert.equal((await post('/api/reservations/actions', booking)).data.ok, true);
    assert.equal((await queue('status')).data.state, 'idle', 'Saving consumes the browser turn');
    await queue('join');
    assert.equal((await queue('leave')).data.state, 'idle');
    assert.equal((await post('/api/reservations/actions', booking)).status, 403);
    assert.equal((await queue('invalid')).status, 400);
    console.log('PASS: non-queue turn admission, fixed deadline, expiry, tampering, save and leave');
  }
} finally {
  child.kill();
  if (child.exitCode === null) await Promise.race([once(child, 'exit'), sleep(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  // Only the unique test directory created above may be removed.
  assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + '\\') || resolve(temp).startsWith(resolve(tmpdir()) + '/'));
  await rm(temp, { recursive: true, force: true });
}
