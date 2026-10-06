-- Run after schema.sql, then set RESERVATION_QUEUE_ENABLED=true on Render.
-- Rerunnable three-person upgrade: existing reservations and settings are not replaced.
begin;
select pg_advisory_xact_lock(910042);

create table if not exists public.pb_booking_queue (
  ticket bigint generated always as identity primary key,
  session_hash text not null unique check (session_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('waiting', 'active', 'expired', 'cancelled', 'complete')),
  joined_at timestamptz not null default clock_timestamp(),
  heartbeat_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz
);
alter table public.pb_booking_queue add column if not exists active_slot smallint;
-- The previous schema allowed only one active ticket; preserve its deadline.
update public.pb_booking_queue set active_slot = 1 where state = 'active' and active_slot is null;
do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.pb_booking_queue'::regclass and conname = 'pb_queue_slot_state') then
    alter table public.pb_booking_queue add constraint pb_queue_slot_state check (
      (state = 'active' and active_slot is not null and active_slot between 1 and 3)
      or (state <> 'active' and active_slot is null)
    );
  end if;
end $$;
create unique index if not exists pb_queue_active_slot
  on public.pb_booking_queue (active_slot) where state = 'active';
drop index if exists public.pb_queue_one_active;
create index if not exists pb_queue_waiting_order
  on public.pb_booking_queue (ticket) where state = 'waiting';
alter table public.pb_booking_queue enable row level security;
revoke all on public.pb_booking_queue from public, anon, authenticated;
revoke all on sequence public.pb_booking_queue_ticket_seq from public, anon, authenticated;

create or replace function public.pb_queue(p_session text, p_operation text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_now timestamptz;
  v_self public.pb_booking_queue%rowtype;
  v_position integer := 0;
  v_slot integer;
begin
  if p_session is null or p_session !~ '^[a-f0-9]{64}$'
    or p_operation not in ('status', 'join', 'leave') or p_operation is null then
    raise exception 'Invalid queue request';
  end if;
  -- All admission and booking writes share this transaction-scoped lock.
  perform pg_advisory_xact_lock(910042);
  v_now := clock_timestamp();
  update public.pb_booking_queue set state = 'expired', active_slot = null
    where (state = 'active' and expires_at <= v_now)
       or (state = 'waiting' and heartbeat_at <= v_now - interval '5 minutes');
  delete from public.pb_booking_queue
    where state in ('expired', 'cancelled', 'complete') and heartbeat_at < v_now - interval '1 day';

  if p_operation = 'join' then
    delete from public.pb_booking_queue where session_hash = p_session
      and state in ('expired', 'cancelled', 'complete');
    insert into public.pb_booking_queue (session_hash, state, heartbeat_at)
      values (p_session, 'waiting', v_now) on conflict (session_hash) do nothing;
  elsif p_operation = 'leave' then
    update public.pb_booking_queue set state = 'cancelled', active_slot = null, heartbeat_at = v_now
      where session_hash = p_session and state in ('waiting', 'active');
  end if;
  update public.pb_booking_queue set heartbeat_at = v_now
    where session_hash = p_session and state in ('waiting', 'active');

  -- Fill every vacancy in FIFO order without extending existing active leases.
  for v_slot in select candidate from generate_series(1, 3) as slots(candidate)
    where not exists (select 1 from public.pb_booking_queue where state = 'active' and active_slot = candidate)
    order by candidate
  loop
    update public.pb_booking_queue set state = 'active', active_slot = v_slot, expires_at = v_now + interval '2 minutes'
      where ticket = (select ticket from public.pb_booking_queue where state = 'waiting' order by ticket limit 1);
    exit when not found;
  end loop;
  select * into v_self from public.pb_booking_queue where session_hash = p_session;
  if v_self.state = 'active' then
    v_position := 1;
  elsif v_self.state = 'waiting' then
    select count(*)::integer + 1 into v_position from public.pb_booking_queue
      where state = 'waiting' and ticket < v_self.ticket;
  end if;
  return jsonb_build_object('enabled', true, 'state', coalesce(v_self.state, 'idle'),
    'position', v_position, 'ahead', greatest(v_position - 1, 0),
    'expiresAt', case when v_self.state = 'active' then v_self.expires_at else null end,
    'serverNow', v_now);
end;
$$;

create or replace function public.pb_queue_commit(
  p_session text, p_mode text, p_bookings jsonb, p_logs jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_now timestamptz;
  v_today timestamp;
  v_window integer;
  v_duration integer;
  v_booking public.pb_bookings%rowtype;
  v_count integer;
begin
  perform pg_advisory_xact_lock(910042);
  v_now := clock_timestamp();
  if not exists (select 1 from public.pb_booking_queue where session_hash = p_session
      and state = 'active' and expires_at > v_now) then
    return jsonb_build_object('ok', false, 'message', 'Your booking turn has ended. Please join the queue again.');
  end if;
  if p_mode is null or p_mode not in ('create', 'update')
    or jsonb_typeof(p_bookings) is distinct from 'array'
    or jsonb_typeof(p_logs) is distinct from 'array' then
    raise exception 'Invalid booking request';
  end if;
  v_count := jsonb_array_length(p_bookings);
  if v_count < 1 or v_count > 3 or jsonb_array_length(p_logs) <> v_count
    or (p_mode = 'update' and v_count <> 1) then
    raise exception 'Invalid booking count';
  end if;
  select booking_window_days, max_duration_days into v_window, v_duration
    from public.pb_settings where id = 'default';
  if v_window is null or v_duration is null then raise exception 'Booking settings are missing'; end if;
  v_today := date_trunc('day', v_now at time zone 'Asia/Seoul');
  for v_booking in select * from jsonb_populate_recordset(null::public.pb_bookings, p_bookings) loop
    if v_booking.start_at is null or v_booking.end_at is null
      or v_booking.start_at < v_today
      or v_booking.start_at >= v_today + make_interval(days => v_window)
      or v_booking.end_at > v_today + make_interval(days => v_window)
      or v_booking.end_at <= v_booking.start_at
      or v_booking.end_at > v_booking.start_at + make_interval(days => v_duration)
      or date_trunc('hour', v_booking.start_at) <> v_booking.start_at
      or date_trunc('hour', v_booking.end_at) <> v_booking.end_at
      or v_booking.status is distinct from 'active'
      or btrim(coalesce(v_booking.applicant, '')) = '' then
      return jsonb_build_object('ok', false, 'message', 'The selected time is outside the current booking rules.');
    end if;
    if exists (select 1 from public.pb_blocked_dates
      where date::timestamp < v_booking.end_at and date::timestamp + interval '1 day' > v_booking.start_at) then
      return jsonb_build_object('ok', false, 'message', 'The selected date is blocked.');
    end if;
  end loop;

  -- This subtransaction rolls back every channel and log if any write fails.
  begin
    if p_mode = 'create' then
      insert into public.pb_bookings (id, applicant, channel, start_at, end_at, purpose, status, created_at, password_hash)
        select id, applicant, channel, start_at, end_at, purpose, status, created_at, password_hash
        from jsonb_populate_recordset(null::public.pb_bookings, p_bookings);
    else
      update public.pb_bookings set channel = v_booking.channel, start_at = v_booking.start_at,
        end_at = v_booking.end_at, purpose = v_booking.purpose
        where id = v_booking.id and status = 'active';
      if not found then
        return jsonb_build_object('ok', false, 'message', 'This booking was cancelled or no longer exists.');
      end if;
    end if;
    insert into public.pb_change_logs (id, actor, action, summary, created_at, booking_id, expires_at)
      select id, actor, action, summary, created_at, booking_id, expires_at
      from jsonb_populate_recordset(null::public.pb_change_logs, p_logs);
    update public.pb_booking_queue set state = 'complete', active_slot = null, heartbeat_at = v_now where session_hash = p_session;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'message', 'A selected channel was just booked. Please choose another time.');
  end;
  perform public.pb_queue(p_session, 'status');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.pb_queue(text, text) from public, anon, authenticated;
revoke all on function public.pb_queue_commit(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.pb_queue(text, text) to service_role;
grant execute on function public.pb_queue_commit(text, text, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
