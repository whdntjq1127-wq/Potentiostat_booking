import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createQueueDatabase } from './verify-queue-sql.mjs';

// Loopback-only fixture. All rows live in an isolated in-memory PostgreSQL instance.
const db = await createQueueDatabase();
const tables = new Set(['pb_bookings', 'pb_change_logs', 'pb_notices', 'pb_settings', 'pb_blocked_dates']);
let databaseUnavailable = false;
const rest = createServer(async (req, res) => {
  try {
    if (databaseUnavailable) { res.writeHead(503); res.end('Unavailable'); return; }
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname.split('/').at(-1);
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    let result;
    if (name === 'pb_queue') {
      result = (await db.query('select pb_queue($1, $2) as value', [body.p_session, body.p_operation])).rows[0].value;
    } else if (name === 'pb_queue_commit') {
      result = (await db.query('select pb_queue_commit($1, $2, $3::jsonb, $4::jsonb) as value',
        [body.p_session, body.p_mode, JSON.stringify(body.p_bookings), JSON.stringify(body.p_logs)])).rows[0].value;
    } else if (tables.has(name) && req.method === 'GET') {
      result = (await db.query(`select to_jsonb(t) as value from public.${name} t`)).rows.map((row) => row.value);
    } else {
      res.writeHead(400); res.end('Unsupported fixture operation'); return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
  } catch (error) { res.writeHead(400); res.end(JSON.stringify({ message: error.message })); }
});
rest.listen(0, '127.0.0.1');
await once(rest, 'listening');
const restUrl = `http://127.0.0.1:${rest.address().port}`;
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, NODE_ENV: 'production', SUPABASE_URL: restUrl,
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_isolated_test_only', RESERVATION_QUEUE_ENABLED: 'true', RESERVATION_STORE_FILE: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk; });
child.stderr.on('data', (chunk) => { logs += chunk; });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function client() {
  let cookie = '';
  async function post(path, body, extra = {}) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: {
      'Content-Type': 'application/json', Origin: base, Cookie: cookie, ...extra,
    }, body: JSON.stringify(body) });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=lax/i);
      cookie = setCookie.split(';')[0];
    }
    return { status: response.status, body: await response.json() };
  }
  return {
    post,
    queue: async (operation = 'status') => (await post('/api/reservations/queue', { operation })).body,
    action: async (body) => (await post('/api/reservations/actions', body)).body,
  };
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(`${base}/api/reservations`)).ok) { ready = true; break; } } catch { /* Starting. */ }
    await sleep(200);
  }
  assert.ok(ready, logs);
  const initialHtml = await (await fetch(base)).text();
  assert.match(initialHtml, /<button[^>]*class="booking-start-button"[^>]*>.*?Book Now/s,
    'The initial page must offer Book Now before choosing a calendar slot');
  assert.doesNotMatch(initialHtml, /<table[\s>]/, 'The calendar stays hidden until admission');
  if (process.argv.includes('--serve')) {
    if (!process.argv.includes('--empty')) {
      for (const token of ['d', 'e', 'f']) {
        await db.query('select pb_queue($1, $2)', [token.repeat(64), 'join']);
      }
    }
    console.log(`UI_URL=${base}\nTEST_REST_URL=${restUrl}`);
    await new Promise((resolve) => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
  } else {
    const a = client(), b = client(), c = client(), d = client(), e = client(), stranger = client();
    await a.queue(); await b.queue(); await c.queue(); await d.queue(); await e.queue();
    assert.equal((await a.queue('join')).state, 'active');
    const bLease = await b.queue('join');
    assert.equal(bLease.state, 'active');
    assert.equal((await c.queue('join')).state, 'active');
    assert.equal((await d.queue('join')).position, 1);
    assert.equal((await e.queue('join')).position, 2);
    assert.equal((await d.queue()).position, 1, 'Status polling keeps cookie position');
    const repeated = await Promise.all(Array.from({ length: 8 }, () => d.queue('join')));
    assert.ok(repeated.every((result) => result.state === 'waiting' && result.position === 1));
    assert.equal((await db.query('select count(*)::int as n from pb_booking_queue')).rows[0].n, 5);
    assert.equal((await db.query("select count(*)::int as n from pb_booking_queue where state = 'active'")).rows[0].n, 3);
    const day = (await db.query("select to_char(clock_timestamp() at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day")).rows[0].day;
    const add = { type: 'addBookings', payload: { applicant: 'API Queue Test', channels: ['CH 1', 'CH 2'],
      startAt: `${day}T09:00`, endAt: `${day}T10:00`, purpose: '' } };
    assert.equal((await stranger.action(add)).ok, false);
    assert.equal((await d.action(add)).ok, false, 'A fourth visitor cannot bypass the admission limit');
    const writes = await Promise.all([a.action(add), a.action(add)]);
    assert.equal(writes.filter((result) => result.ok).length, 1, 'Only one simultaneous submission consumes the lease');
    assert.equal(writes.find((result) => result.ok).snapshot.bookings[0].startAt, add.payload.startAt, 'Fixture preserves timestamp-without-time-zone values');
    assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 2);
    assert.equal((await db.query('select count(*)::int as n from pb_change_logs')).rows[0].n, 2);
    assert.equal((await b.queue()).state, 'active');
    assert.equal((await b.queue()).expiresAt, bLease.expiresAt, 'Other bookings do not restart an active lease');
    assert.equal((await d.queue()).state, 'active', 'Saving admits the oldest waiting visitor');
    assert.equal((await e.queue()).position, 1);
    const existing = (await db.query('select id from pb_bookings limit 1')).rows[0].id;
    const edit = { type: 'updateBooking', payload: { id: existing, requestedBy: 'Test', channel: 'CH 3',
      startAt: `${day}T10:00`, endAt: `${day}T11:00`, purpose: '' } };
    assert.equal((await e.action(edit)).ok, false, 'Editing cannot bypass queue');
    assert.equal((await b.action(edit)).ok, true);
    assert.equal((await e.queue()).state, 'active');
    const competing = { type: 'addBookings', payload: { ...add.payload, channels: ['CH 1'],
      startAt: `${day}T12:00`, endAt: `${day}T13:00` } };
    const race = await Promise.all([c.action(competing), d.action(competing)]);
    assert.equal(race.filter((result) => result.ok).length, 1, 'Two admitted visitors cannot book the same channel/time');
    assert.equal((await (race[0].ok ? d : c).queue()).state, 'active', 'The unsuccessful visitor keeps their remaining time');
    assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 3);
    assert.equal((await db.query('select count(*)::int as n from pb_change_logs')).rows[0].n, 4);
    await db.exec("update pb_booking_queue set expires_at = clock_timestamp() - interval '1 second' where state = 'active'");
    assert.equal((await e.action(edit)).ok, false);
    await e.queue();
    const burst = await Promise.all(Array.from({ length: 12 }, () => client().queue('join')));
    assert.equal(burst.filter((result) => result.state === 'active').length, 3, 'A burst admits only three sessions');
    assert.deepEqual(burst.filter((result) => result.state === 'waiting').map((result) => result.position).sort((x, y) => x - y),
      [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal((await db.query("select count(*)::int as n from pb_booking_queue where state = 'active'")).rows[0].n, 3);
    const csrf = await stranger.post('/api/reservations/queue', { operation: 'join' }, { Origin: 'https://untrusted.example' });
    assert.equal(csrf.status, 403);
    databaseUnavailable = true;
    assert.equal((await a.post('/api/reservations/queue', { operation: 'join' })).status, 503, 'No bypass when database is down');
    assert.equal((await a.action(add)).ok, false);
    console.log('PASS: real Next API, three-person admission, FIFO refill, 12-client burst, conflict/replay safety, editing, expiry, CSRF and outage');
  }
} finally {
  child.kill();
  await Promise.race([once(child, 'exit'), sleep(3000)]);
  rest.closeAllConnections();
  await new Promise((resolve) => rest.close(resolve));
  await db.close();
}
