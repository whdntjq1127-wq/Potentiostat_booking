import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const migration = new URL('../database/booking-queue.sql', import.meta.url);
assert.ok(existsSync(migration), 'Durable queue migration must exist');
export async function createQueueDatabase(queueSql = readFileSync(migration, 'utf8')) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec('create role service_role; create role anon; create role authenticated;');
  await db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  await db.exec(queueSql);
  return db;
}

async function run() {
  const db = await createQueueDatabase();
  const tokens = ['a', 'b', 'c', 'd'].map((s) => s.repeat(64));
  const [a, b, c, d] = tokens;
  const queue = async (token, op = 'status') => (await db.query(
    'select public.pb_queue($1, $2) as result', [token, op],
  )).rows[0].result;
  const commit = async (token, mode, bookings, logs) => (await db.query(
    'select public.pb_queue_commit($1, $2, $3::jsonb, $4::jsonb) as result',
    [token, mode, JSON.stringify(bookings), JSON.stringify(logs)],
  )).rows[0].result;
  try {
    // Keep two slots occupied while exercising the existing one-vacancy regressions.
    assert.equal((await queue('e'.repeat(64), 'join')).state, 'active');
    assert.equal((await queue('f'.repeat(64), 'join')).state, 'active');
    assert.equal((await queue(a, 'join')).state, 'active');
    const expiry = (await queue(a)).expiresAt;
    assert.equal((await queue(a, 'join')).expiresAt, expiry, 'Duplicate join must not extend lease');
    assert.equal((await queue(b, 'join')).position, 1);
    assert.equal((await queue(c, 'join')).position, 2);
    assert.equal((await queue(b, 'join')).position, 1);
    assert.equal((await queue(d)).state, 'idle', 'Polling must not join');
    assert.equal((await commit(b, 'create', [], [])).ok, false, 'Waiters cannot write');
    await queue(a, 'leave');
    assert.equal((await queue(b)).state, 'active');
    await db.query("update pb_booking_queue set expires_at = clock_timestamp() - interval '1 second' where session_hash = $1", [b]);
    assert.equal((await commit(b, 'create', [], [])).ok, false, 'Expired lease cannot write');
    assert.equal((await queue(b)).state, 'expired');
    assert.equal((await queue(c)).state, 'active');
    const day = (await db.query("select to_char(clock_timestamp() at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day")).rows[0].day;
    const booking = (id, channel = 'CH 1') => ({ id, applicant: 'Queue SQL Test', channel,
      start_at: `${day}T09:00`, end_at: `${day}T10:00`, purpose: '', status: 'active',
      created_at: new Date().toISOString(), password_hash: null });
    const log = (id) => ({ id: `log-${id}`, actor: 'Test', action: 'booking_created', summary: 'Queue test',
      created_at: new Date().toISOString(), booking_id: id, expires_at: null });
    const cLease = await queue(c);
    await queue(d, 'join');
    assert.equal((await commit(c, 'create', [booking('one'), booking('two', 'CH 2')], [log('one'), log('two')])).ok, true);
    assert.equal((await queue(c)).state, 'active', 'Saving must preserve admission');
    assert.equal((await queue(c)).expiresAt, cLease.expiresAt, 'Saving must not extend the original deadline');
    assert.equal((await queue(d)).state, 'waiting', 'Saving does not release a visitor slot');
    const additional = { ...booking('additional', 'CH 4'), start_at: `${day}T11:00`, end_at: `${day}T12:00` };
    assert.equal((await commit(c, 'create', [additional], [log('additional')])).ok, true, 'Same turn permits another booking');
    const updated = { ...additional, end_at: `${day}T13:00` };
    assert.equal((await commit(c, 'update', [updated], [log('additional-edit')])).ok, true);
    assert.equal((await queue(c, 'join')).expiresAt, cLease.expiresAt, 'Create, update and repeated join keep the deadline');
    assert.equal((await commit(c, 'create', [booking('repeat')], [log('repeat')])).ok, false);
    assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 3);
    await db.query("update pb_booking_queue set expires_at = clock_timestamp() - interval '1 second' where session_hash = $1", [c]);
    assert.equal((await commit(c, 'create', [booking('too-late', 'CH 5')], [log('too-late')])).ok, false, 'Expired repeat writes are rejected');
    assert.equal((await queue(d)).state, 'active', 'Expiry admits the oldest waiting visitor');
    assert.equal((await commit(d, 'create', [booking('three', 'CH 3'), booking('overlap')], [log('three'), log('overlap')])).ok, false);
    assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 3, 'Multi-channel conflict rolls back all rows');
    assert.equal((await queue(d)).state, 'active', 'Validation failure preserves turn');
    await assert.rejects(commit(d, 'create', [booking('bad-log', 'CH 3')], [{ ...log('bad-log'), action: 'invalid' }]));
    assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 3, 'Log failure rolls back bookings');
    const outside = { ...booking('outside', 'CH 3'), end_at: `${day}T10:30` };
    assert.equal((await commit(d, 'create', [outside], [log('outside')])).ok, false);
    await db.query("update pb_bookings set status = 'cancelled' where id = 'one'");
    assert.equal((await commit(d, 'update', [booking('one')], [log('edit')])).ok, false, 'Edit cannot revive cancelled booking');
    await queue(a, 'join');
    await db.query("update pb_booking_queue set heartbeat_at = clock_timestamp() - interval '6 minutes' where session_hash = $1", [a]);
    await queue(d, 'leave');
    assert.equal((await queue(a)).state, 'expired', 'Abandoned waiter must not block next turn');
    await db.exec(readFileSync(migration, 'utf8'));
    assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 3, 'Migration is additive and rerunnable');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.pb_booking_queue'));
      await assert.rejects(queue(a, 'join'));
      await assert.rejects(commit(a, 'create', [], []));
      await db.exec('reset role');
    }
    console.log('PASS: repeat create/edit, fixed lease, FIFO, expiry, atomic conflicts, grants and migration safety');
  } finally { await db.close(); }
}
if (process.argv[1]?.endsWith('verify-queue-sql.mjs')) {
  run().catch((error) => { console.error(error); process.exitCode = 1; });
}
