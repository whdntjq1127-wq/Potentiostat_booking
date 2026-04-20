export const CHANNELS = ['CH 1', 'CH 2', 'CH 3'] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_COLORS: Record<Channel, string> = {
  'CH 1': '#FDE724',
  'CH 2': '#BADE27',
  'CH 3': '#44BE70',
};

export type BookingStatus = 'active' | 'cancelled';

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

export type ReservationSettings = {
  bookingWindowDays: number;
  maxDurationDays: number;
};

export type ReservationSnapshot = {
  bookings: Booking[];
  blockedDates: string[];
  notices: string[];
  settings: ReservationSettings;
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
  const today = startOfDay(now);
  const latest = addDays(today, settings.bookingWindowDays);
  const startDate = startOfDay(start);

  return startDate >= today && startDate <= latest;
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

export function compareBookings(a: Booking, b: Booking) {
  return a.startAt.localeCompare(b.startAt);
}

export function getStatusLabel(status: BookingStatus) {
  return status === 'cancelled' ? '취소됨' : '예약 완료';
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
      endAt: toDateTimeLocal(addHours(firstBookingStart, 2)),
      purpose: '전극 안정성 측정',
      status: 'active',
      createdAt: toDateTimeLocal(addHours(base, 9)),
    },
    {
      id: 'bk-002',
      applicant: '박실험',
      channel: 'CH 2',
      startAt: toDateTimeLocal(secondBookingStart),
      endAt: toDateTimeLocal(addHours(secondBookingStart, 3)),
      purpose: '임피던스 비교 실험',
      status: 'active',
      createdAt: toDateTimeLocal(addHours(base, 11)),
    },
  ];

  return {
    settings: DEFAULT_SETTINGS,
    blockedDates: [toDateKey(addDays(base, 4))],
    notices: [
      '이 사이트는 로그인 없이 이름만 입력해 예약하는 데모 버전입니다.',
      '동일 시간대에는 한 사람만 장비를 운용할 수 있어 채널이 달라도 중복 예약이 불가능합니다.',
      '관리자 페이지에서 예약 가능 범위와 최대 사용 기간을 바로 수정할 수 있습니다.',
    ],
    bookings: bookings.sort(compareBookings),
  };
}
