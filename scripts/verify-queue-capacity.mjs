import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQueueDatabase } from './verify-queue-sql.mjs';

const migration = readFileSync(new URL('../database/booking-queue.sql', import.meta.url), 'utf8');
const tokens = Array.from({ length: 12 }, (_, i) => i.toString(16).padStart(64, '0'));
const db = await createQueueDatabase();
const queue = async (token, operation = 'status') => (await db.query(
  'select public.pb_queue($1, $2) as result', [token, operation],
)).rows[0].result;
const activeCount = async () => (await db.query(
  "select count(*)::int as n from pb_booking_queue where state = 'active'",
)).rows[0].n;

try {
  const leases = [];
  for (const token of tokens.slice(0, 3)) {
    const status = await queue(token, 'join');
    assert.equal(status.state, 'active', 'The first three visitors must enter immediately');
    assert.equal(Date.parse(status.expiresAt) - Date.parse(status.serverNow), 120_000);
    leases.push(status.expiresAt);
  }
  for (const [i, token] of tokens.slice(3, 6).entries()) {
    const status = await queue(token, 'join');
    assert.equal(status.state, 'waiting');
    assert.equal(status.position, i + 1, 'Positions count waiting visitors only');
    assert.equal(status.ahead, i);
    assert.equal(status.expiresAt, null, 'Waiting does not consume the two-minute lease');
  }
  assert.equal(await activeCount(), 3);
  for (const [i, token] of tokens.slice(0, 3).entries()) {
    assert.equal((await queue(token, 'join')).expiresAt, leases[i], 'Joining again never extends a lease');
  }
  assert.equal((await queue(tokens[3], 'join')).position, 1, 'Joining again never changes FIFO order');

  await assert.rejects(db.query(
    "insert into pb_booking_queue (session_hash, state, active_slot) values ($1, 'active', 1)", [tokens[6]],
  ), /unique|duplicate/i, 'Two active visitors cannot share a slot');
  for (const slot of [null, 0, 4]) {
    await assert.rejects(db.query(
      "insert into pb_booking_queue (session_hash, state, active_slot) values ($1, 'active', $2)", [tokens[6], slot],
    ), /check constraint/i, 'The database enforces exactly three possible active slots');
  }

  await queue(tokens[1], 'leave');
  assert.equal((await queue(tokens[3])).state, 'active', 'A vacancy admits the oldest waiter');
  assert.equal((await queue(tokens[4])).position, 1);
  assert.equal((await queue(tokens[5])).position, 2);
  assert.equal((await queue(tokens[0])).expiresAt, leases[0], 'Other visitors retain their original leases');
  assert.equal(await activeCount(), 3);

  await db.query("update pb_booking_queue set expires_at = clock_timestamp() - interval '1 second' where session_hash in ($1, $2)",
    [tokens[0], tokens[2]]);
  const promoted = await queue(tokens[5]);
  assert.equal(promoted.state, 'active', 'One poll must refill every available slot');
  assert.equal(Date.parse(promoted.expiresAt) - Date.parse(promoted.serverNow), 120_000);
  assert.equal((await queue(tokens[4])).state, 'active');
  assert.equal((await queue(tokens[0])).state, 'expired');
  assert.equal(await activeCount(), 3);

  await queue(tokens[6], 'join');
  await queue(tokens[7], 'join');
  await db.query("update pb_booking_queue set heartbeat_at = clock_timestamp() - interval '6 minutes' where session_hash = $1", [tokens[6]]);
  await queue(tokens[3], 'leave');
  assert.equal((await queue(tokens[6])).state, 'expired');
  assert.equal((await queue(tokens[7])).state, 'active', 'Disconnected waiters are skipped');
  assert.equal((await queue(tokens[1], 'join')).state, 'waiting', 'Leaving and rejoining goes to the back');
  assert.equal((await queue(tokens[8])).state, 'idle', 'Status alone never joins the queue');

  const before = (await db.query('select * from pb_booking_queue order by ticket')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select * from pb_booking_queue order by ticket')).rows, before,
    'Reapplying the migration preserves tickets, deadlines and assigned slots');
  console.log('PASS: three slots, FIFO, individual fixed leases, refill, expiry, constraints and rerunnable migration');
} finally { await db.close(); }

// Reproduce the installed one-person schema without depending on git history.
const legacy = await createQueueDatabase(`
  create table public.pb_booking_queue (
    ticket bigint generated always as identity primary key,
    session_hash text not null unique check (session_hash ~ '^[a-f0-9]{64}$'),
    state text not null check (state in ('waiting', 'active', 'expired', 'cancelled', 'complete')),
    joined_at timestamptz not null default clock_timestamp(),
    heartbeat_at timestamptz not null default clock_timestamp(),
    expires_at timestamptz
  );
  create unique index pb_queue_one_active on public.pb_booking_queue ((true)) where state = 'active';
`);
try {
  for (const [i, token] of tokens.slice(0, 4).entries()) {
    await legacy.query(`insert into pb_booking_queue (session_hash, state, expires_at)
      values ($1, $2, case when $2 = 'active' then clock_timestamp() + interval '2 minutes' end)`,
    [token, i === 0 ? 'active' : 'waiting']);
  }
  await legacy.exec(`insert into pb_bookings (id, applicant, channel, start_at, end_at, status)
    values ('existing-booking', 'Keep Me', 'CH 1', '2026-10-06 09:00', '2026-10-06 10:00', 'active');
    insert into pb_change_logs (id, actor, action, summary) values ('existing-log', 'Keep Me', 'booking_created', 'Existing log');
    update pb_settings set booking_window_days = 4, max_duration_days = 2 where id = 'default';`);
  const before = (await legacy.query('select ticket, session_hash, state, expires_at from pb_booking_queue order by ticket')).rows;
  const records = async () => (await legacy.query(`select
    (select jsonb_agg(t) from pb_bookings t) as bookings,
    (select jsonb_agg(t) from pb_change_logs t) as logs,
    (select jsonb_agg(t) from pb_settings t) as settings`)).rows;
  const saved = await records();
  await legacy.exec(migration);
  assert.deepEqual((await legacy.query('select ticket, session_hash, state, expires_at from pb_booking_queue order by ticket')).rows, before);
  assert.deepEqual(await records(), saved, 'Upgrading never alters existing reservations, logs or settings');
  assert.equal((await legacy.query("select to_regclass('public.pb_queue_one_active') as old_index")).rows[0].old_index, null);
  const admitted = (await legacy.query("select pb_queue($1, 'status') as result", [tokens[2]])).rows[0].result;
  assert.equal(admitted.state, 'active', 'The upgrade frees the second and third slots');
  assert.equal((await legacy.query("select pb_queue($1, 'status') as result", [tokens[3]])).rows[0].result.position, 1);
  assert.deepEqual((await legacy.query('select expires_at from pb_booking_queue where session_hash = $1', [tokens[0]])).rows[0].expires_at,
    before[0].expires_at, 'Upgrade does not restart an existing lease');
  console.log('PASS: one-person schema upgrade preserves bookings, logs, settings and active/waiting tickets');
} finally { await legacy.close(); }
