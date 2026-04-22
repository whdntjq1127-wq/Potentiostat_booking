create extension if not exists btree_gist;

create table if not exists pb_bookings (
  id text primary key,
  applicant text not null,
  channel text not null check (channel in ('CH 1', 'CH 2', 'CH 3')),
  start_at timestamp without time zone not null,
  end_at timestamp without time zone not null,
  purpose text not null default '',
  status text not null check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pb_bookings_no_active_overlap'
  ) then
    alter table pb_bookings
      add constraint pb_bookings_no_active_overlap
      exclude using gist (
        channel with =,
        tsrange(start_at, end_at, '[)') with &&
      )
      where (status = 'active');
  end if;
end $$;

create table if not exists pb_change_logs (
  id text primary key,
  actor text not null,
  action text not null check (
    action in (
      'booking_created',
      'booking_updated',
      'booking_cancelled',
      'blocked_date_added',
      'blocked_date_removed',
      'notice_added',
      'notice_removed',
      'settings_updated'
    )
  ),
  summary text not null,
  created_at timestamptz not null default now(),
  booking_id text,
  expires_at timestamptz
);

create table if not exists pb_blocked_dates (
  date date primary key,
  created_at timestamptz not null default now()
);

create table if not exists pb_notices (
  notice text primary key,
  created_at timestamptz not null default now()
);

create table if not exists pb_settings (
  id text primary key default 'default',
  booking_window_days integer not null default 5 check (booking_window_days >= 0),
  max_duration_days integer not null default 5 check (max_duration_days > 0),
  updated_at timestamptz not null default now()
);

insert into pb_settings (id, booking_window_days, max_duration_days)
values ('default', 5, 5)
on conflict (id) do nothing;
