export const CHANNELS = ['CH 1', 'CH 2', 'CH 3'] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_COLORS: Record<Channel, string> = {
  'CH 1': '#8B919A',
  'CH 2': '#A8AEB6',
  'CH 3': '#C8CDD3',
};

export type BookingStatus = 'active' | 'cancelled';

export type ChangeAction =
  | 'booking_created'
  | 'booking_updated'
  | 'booking_cancelled'
  | 'blocked_date_added'
  | 'blocked_date_removed'
  | 'notice_added'
  | 'notice_removed'
  | 'settings_updated';

export type Booking = {
  id: string;
  applicant: string;
  channel: Channel;
  startAt: string;
  endAt: string;
  purpose: string;
  status: BookingStatus;
  createdAt: string;
};

export type ChangeLogEntry = {
  id: string;
  actor: string;
  action: ChangeAction;
  summary: string;
  createdAt: string;
  bookingId?: string;
  expiresAt?: string;
};

export type ReservationSettings = {
  bookingWindowDays: number;
  maxDurationDays: number;
};

export type ReservationSnapshot = {
  bookings: Booking[];
  blockedDates: string[];
  notices: string[];
  settings: ReservationSettings;
  changeLogs: ChangeLogEntry[];
};

export const DEFAULT_SETTINGS: ReservationSettings = {
  bookingWindowDays: 5,
  maxDurationDays: 5,
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function setHour(date: Date, hour: number) {
  const next = startOfDay(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

export function ceilToHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  if (
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0 ||
    date.getMilliseconds() !== 0
  ) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeKey(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function formatDisplayTime(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = date.getMinutes();

  if (minute === 0) {
    return `${hour}시`;
  }

  return `${hour}:${String(minute).padStart(2, '0')}`;
}

export function toDateTimeLocal(date: Date) {
  return `${toDateKey(date)}T${toTimeKey(date)}`;
}

export function fromDateTimeLocal(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateLabel(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;
}

export function formatShortDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()} (${DAY_NAMES[date.getDay()]})`;
}

export function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}시`;
}

export function formatDateTimeLabel(value: string) {
  const parsed = fromDateTimeLocal(value);
  if (!parsed) {
    return value;
  }
  return `${formatDateLabel(parsed)} ${formatDisplayTime(parsed)}`;
}

export function formatBookingRange(startAt: string, endAt: string) {
  return `${formatDateTimeLabel(startAt)} - ${formatDateTimeLabel(endAt)}`;
}

export function getWeekDates(anchorDate: Date) {
  const first = startOfDay(anchorDate);
  first.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export function getSlotRows() {
  const rows: Array<{
    id: string;
    channel: Channel;
    hour: number;
    label: string;
  }> = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const start = formatHourLabel(hour);
    const end = formatHourLabel((hour + 1) % 24);

    for (const channel of CHANNELS) {
      rows.push({
        id: `${channel}-${hour}`,
        channel,
        hour,
        label: `${channel} ${start}-${end}`,
      });
    }
  }

  return rows;
}

export function getChannelColor(channel: Channel) {
  return CHANNEL_COLORS[channel];
}

export function getChannelSoftColor(channel: Channel) {
  const softMap: Record<Channel, string> = {
    'CH 1': '#E3E5E8',
    'CH 2': '#ECEDEF',
    'CH 3': '#F4F5F6',
  };

  return softMap[channel];
}

export function overlaps(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) {
  return startA < endB && endA > startB;
}

export function getCoveredDateKeys(start: Date, end: Date) {
  const covered: string[] = [];
  const cursor = startOfDay(start);

  while (cursor < end) {
    covered.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return covered;
}

export function isStartWithinBookingWindow(
  start: Date,
  settings: ReservationSettings,
  now = new Date(),
) {
  const first = startOfDay(now);
  const latest = addDays(first, settings.bookingWindowDays);
  const startDate = startOfDay(start);

  return startDate >= first && startDate <= latest;
}

export function getLatestBookableDate(
  settings: ReservationSettings,
  now = new Date(),
) {
  return addDays(startOfDay(now), settings.bookingWindowDays);
}

export function getLatestAllowedEnd(
  start: Date,
  settings: ReservationSettings,
) {
  return addHours(start, settings.maxDurationDays * 24);
}

export function getBookingExpiryDate(endAt: string) {
  const end = fromDateTimeLocal(endAt);

  if (!end) {
    return null;
  }

  return addDays(startOfDay(end), 7);
}

export function pruneExpiredReservationState(
  snapshot: ReservationSnapshot,
  now = new Date(),
) {
  const today = startOfDay(now);
  const activeBookings = snapshot.bookings.filter((booking) => {
    const expiresAt = getBookingExpiryDate(booking.endAt);

    if (!expiresAt) {
      return true;
    }

    return expiresAt > today;
  });

  const removedBookingIds = new Set(
    snapshot.bookings
      .filter(
        (booking) => !activeBookings.some((active) => active.id === booking.id),
      )
      .map((booking) => booking.id),
  );

  const activeLogs = snapshot.changeLogs.filter((entry) => {
    if (entry.bookingId && removedBookingIds.has(entry.bookingId)) {
      return false;
    }

    if (!entry.expiresAt) {
      return true;
    }

    const expiresAt = new Date(entry.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return true;
    }

    return startOfDay(expiresAt) > today;
  });

  if (
    activeBookings.length === snapshot.bookings.length &&
    activeLogs.length === snapshot.changeLogs.length
  ) {
    return snapshot;
  }

  return {
    ...snapshot,
    bookings: activeBookings.sort(compareBookings),
    changeLogs: activeLogs.sort(compareChangeLogs),
  };
}

export function compareBookings(a: Booking, b: Booking) {
  return a.startAt.localeCompare(b.startAt);
}

export function compareChangeLogs(a: ChangeLogEntry, b: ChangeLogEntry) {
  return b.createdAt.localeCompare(a.createdAt);
}

export function getStatusLabel(status: BookingStatus) {
  return status === 'cancelled' ? '취소됨' : '예약 완료';
}

export function getChangeActionLabel(action: ChangeAction) {
  switch (action) {
    case 'booking_created':
      return '예약 등록';
    case 'booking_updated':
      return '예약 수정';
    case 'booking_cancelled':
      return '예약 취소';
    case 'blocked_date_added':
      return '차단일 추가';
    case 'blocked_date_removed':
      return '차단일 해제';
    case 'notice_added':
      return '공지 추가';
    case 'notice_removed':
      return '공지 삭제';
    case 'settings_updated':
      return '규칙 변경';
    default:
      return '변경';
  }
}

export function buildBookingSummary(booking: {
  channel: Channel;
  startAt: string;
  endAt: string;
  purpose?: string;
}) {
  const purposeText = booking.purpose?.trim()
    ? ` · ${booking.purpose.trim()}`
    : '';

  return `${booking.channel} · ${formatBookingRange(booking.startAt, booking.endAt)}${purposeText}`;
}

export function createInitialReservationState(
  now = new Date(),
): ReservationSnapshot {
  const base = startOfDay(now);
  const firstBookingStart = addHours(addDays(base, 1), 10);
  const secondBookingStart = addHours(addDays(base, 2), 13);
  const bookings: Booking[] = [
    {
      id: 'bk-001',
      applicant: '김연구',
      channel: 'CH 1',
      startAt: toDateTimeLocal(firstBookingStart),
      endAt: toDateTimeLocal(addHours(firstBookingStart, 1)),
      purpose: '전극 안정성 측정',
      status: 'active',
      createdAt: toDateTimeLocal(addHours(base, 9)),
    },
    {
      id: 'bk-002',
      applicant: '박실험',
      channel: 'CH 2',
      startAt: toDateTimeLocal(secondBookingStart),
      endAt: toDateTimeLocal(addHours(secondBookingStart, 1)),
      purpose: '임피던스 비교 실험',
      status: 'active',
      createdAt: toDateTimeLocal(addHours(base, 11)),
    },
  ];

  return {
    settings: DEFAULT_SETTINGS,
    blockedDates: [],
    notices: [
      '이 사이트는 로그인 없이 이름만 입력해 예약하는 데모 버전입니다.',
      '각 채널은 독립적으로 예약되며, 같은 채널 안에서만 시간 중복이 제한됩니다.',
      '예약 생성, 수정, 취소는 모두 공개 로그북에 기록됩니다.',
    ],
    changeLogs: [
      {
        id: 'log-001',
        actor: '김연구',
        action: 'booking_created',
        summary: buildBookingSummary({
          channel: 'CH 1',
          startAt: toDateTimeLocal(firstBookingStart),
          endAt: toDateTimeLocal(addHours(firstBookingStart, 1)),
          purpose: '전극 안정성 측정',
        }),
        createdAt: addHours(base, 9).toISOString(),
        bookingId: 'bk-001',
        expiresAt: getBookingExpiryDate(
          toDateTimeLocal(addHours(firstBookingStart, 1)),
        )?.toISOString(),
      },
      {
        id: 'log-002',
        actor: '박실험',
        action: 'booking_created',
        summary: buildBookingSummary({
          channel: 'CH 2',
          startAt: toDateTimeLocal(secondBookingStart),
          endAt: toDateTimeLocal(addHours(secondBookingStart, 1)),
          purpose: '임피던스 비교 실험',
        }),
        createdAt: addHours(base, 11).toISOString(),
        bookingId: 'bk-002',
        expiresAt: getBookingExpiryDate(
          toDateTimeLocal(addHours(secondBookingStart, 1)),
        )?.toISOString(),
      },
    ],
    bookings: bookings.sort(compareBookings),
  };
}
