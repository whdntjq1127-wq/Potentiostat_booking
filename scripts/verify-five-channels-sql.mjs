import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQueueDatabase } from './verify-queue-sql.mjs';

const migration = readFileSync(new URL('../database/booking-queue.sql', import.meta.url), 'utf8');
const channels = ['CH 1', 'CH 2', 'CH 3', 'CH 4', 'CH 5'];
const db = await createQueueDatabase();
const token = 'a'.repeat(64);
const queue = async (session = token, operation = 'join') => (await db.query(
  'select pb_queue($1, $2) as result', [session, operation],
)).rows[0].result;
const commit = async (bookings, logs, mode = 'create') => (await db.query(
  'select pb_queue_commit($1, $2, $3::jsonb, $4::jsonb) as result',
  [token, mode, JSON.stringify(bookings), JSON.stringify(logs)],
)).rows[0].result;
try {
  const day = (await db.query("select to_char(clock_timestamp() at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day")).rows[0].day;
  const booking = (id, channel, start = '09:00', end = '10:00') => ({
    id, applicant: 'Five Channel SQL Test', channel, start_at: `${day}T${start}`, end_at: `${day}T${end}`,
    purpose: '', status: 'active', created_at: new Date().toISOString(), password_hash: null,
  });
  const log = (b) => ({
    id: `log-${b.id}`, actor: 'Test', action: 'booking_created', summary: b.channel,
    created_at: new Date().toISOString(), booking_id: b.id, expires_at: null,
  });
  await queue();
  const bookings = channels.map((ch, i) => booking(`five-${i}`, ch));
  assert.equal((await commit(bookings, bookings.map(log))).ok, true, 'All five channels save atomically in one turn');
  assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 5);
  assert.equal((await db.query('select count(*)::int as n from pb_change_logs')).rows[0].n, 5);
  await queue();
  const conflict = [booking('free', 'CH 4', '10:00', '11:00'), booking('taken', 'CH 5')];
  assert.equal((await commit(conflict, conflict.map(log))).ok, false);
  assert.equal((await db.query('select count(*)::int as n from pb_bookings')).rows[0].n, 5, 'A CH 5 conflict rolls back every channel');
  const edited = booking('five-0', 'CH 5', '10:00', '11:00');
  assert.equal((await commit([edited], [{ ...log(edited), id: 'edit-five', action: 'booking_updated' }], 'update')).ok, true);
  assert.equal((await db.query("select channel from pb_bookings where id = 'five-0'")).rows[0].channel, 'CH 5');
  await queue();
  const bad = booking('six', 'CH 6');
  await assert.rejects(commit([bad], [log(bad)]), /channel|constraint/i);
  const tooMany = [...bookings, booking('sixth', 'CH 1', '12:00', '13:00')];
  await assert.rejects(commit(tooMany, tooMany.map(log)), /Invalid booking count/);
  await queue('b'.repeat(64));
  await queue('c'.repeat(64));
  assert.equal((await queue('d'.repeat(64))).state, 'waiting', 'Five channels still allow only three concurrent visitors');
  console.log('PASS: five-channel SQL writes, updates, atomic conflicts, invalid channels/counts and unchanged admission cap');
} finally { await db.close(); }

// Test the actual upgrade path from the old three-channel constraint.
const legacy = await createQueueDatabase('');
try {
  await legacy.exec(`begin;
    insert into pb_bookings (id, applicant, channel, start_at, end_at, status)
      values ('fresh-4', 'Test', 'CH 4', '2026-10-20 09:00', '2026-10-20 10:00', 'active'),
             ('fresh-5', 'Test', 'CH 5', '2026-10-20 09:00', '2026-10-20 10:00', 'active');
    rollback;`);
  await legacy.exec(`alter table pb_bookings drop constraint pb_bookings_channel_check;
    alter table pb_bookings add constraint pb_bookings_channel_check check (channel in ('CH 1', 'CH 2', 'CH 3'));
    insert into pb_bookings (id, applicant, channel, start_at, end_at, status)
      values ('keep', 'Existing User', 'CH 1', '2026-10-20 09:00', '2026-10-20 10:00', 'active');
    insert into pb_change_logs (id, actor, action, summary) values ('keep-log', 'Test', 'booking_created', 'Keep log');
    update pb_settings set booking_window_days = 4 where id = 'default';`);
  const read = async () => (await legacy.query(`select
    (select jsonb_agg(b) from pb_bookings b) as bookings,
    (select jsonb_agg(l) from pb_change_logs l) as logs,
    (select jsonb_agg(s) from pb_settings s) as settings`)).rows;
  const before = await read();
  await legacy.exec(migration);
  await legacy.exec(migration);
  assert.deepEqual(await read(), before, 'Upgrade and rerun preserve existing reservations, logs and settings');
  for (const channel of ['CH 4', 'CH 5']) {
    await legacy.query(`insert into pb_bookings (id, applicant, channel, start_at, end_at, status)
      values ($1, 'New User', $1, '2026-10-20 09:00', '2026-10-20 10:00', 'active')`, [channel]);
  }
  await assert.rejects(legacy.query(`insert into pb_bookings (id, applicant, channel, start_at, end_at, status)
    values ('bad', 'Test', 'CH 6', '2026-10-20 09:00', '2026-10-20 10:00', 'active')`), /check constraint/);
  await assert.rejects(legacy.query(`insert into pb_bookings (id, applicant, channel, start_at, end_at, status)
    values ('overlap', 'Test', 'CH 5', '2026-10-20 09:00', '2026-10-20 10:00', 'active')`), /exclusion|conflicting/);
  console.log('PASS: fresh schema plus rerunnable three-to-five-channel migration preserve records and overlap protection');
} finally { await legacy.close(); }
