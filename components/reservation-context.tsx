'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  compareBookings,
  createInitialReservationState,
  fromDateTimeLocal,
  getCoveredDateKeys,
  getLatestAllowedEnd,
  isStartWithinBookingWindow,
  overlaps,
  type Booking,
  type Channel,
  type ReservationSettings,
  type ReservationSnapshot,
} from '../lib/reservation-data';

const STORAGE_KEY = 'potentiostat-booking-demo-v2';

type ActionResult = {
  ok: boolean;
  message: string;
};

type ReservationContextValue = {
  ready: boolean;
  bookings: Booking[];
  blockedDates: string[];
  notices: string[];
  settings: ReservationSettings;
  addBooking: (input: {
    applicant: string;
    channel: Channel;
    startAt: string;
    endAt: string;
    purpose: string;
  }) => ActionResult;
  updateBooking: (input: {
    id: string;
    channel: Channel;
    startAt: string;
    endAt: string;
    purpose: string;
  }) => ActionResult;
  cancelBooking: (id: string) => void;
  addBlockedDate: (date: string) => ActionResult;
  removeBlockedDate: (date: string) => void;
  addNotice: (notice: string) => ActionResult;
  removeNotice: (notice: string) => void;
  updateSettings: (next: ReservationSettings) => ActionResult;
};

const ReservationContext = createContext<ReservationContextValue | null>(null);

function parseStoredState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as ReservationSnapshot;
  } catch {
    return null;
  }
}

function isActive(booking: Booking) {
  return booking.status === 'active';
}

function getConflictBooking(
  bookings: Booking[],
  start: Date,
  end: Date,
  ignoreId?: string,
) {
  return bookings.find((booking) => {
    if (!isActive(booking) || booking.id === ignoreId) {
      return false;
    }

    return overlaps(
      start,
      end,
      new Date(booking.startAt),
      new Date(booking.endAt),
    );
  });
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ReservationSnapshot>(() =>
    createInitialReservationState(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = parseStoredState();
    if (stored) {
      setSnapshot({
        ...stored,
        bookings: [...stored.bookings].sort(compareBookings),
      });
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [ready, snapshot]);

  const value = useMemo<ReservationContextValue>(
    () => ({
      ready,
      bookings: snapshot.bookings,
      blockedDates: snapshot.blockedDates,
      notices: snapshot.notices,
      settings: snapshot.settings,
      addBooking: ({ applicant, channel, startAt, endAt, purpose }) => {
        const trimmedApplicant = applicant.trim();
        const trimmedPurpose = purpose.trim();

        if (!trimmedApplicant) {
          return { ok: false, message: '사용자 이름은 반드시 입력해야 합니다.' };
        }

        const start = fromDateTimeLocal(startAt);
        const end = fromDateTimeLocal(endAt);

        if (!start || !end) {
          return { ok: false, message: '시작 시각과 종료 시각을 올바르게 입력해 주세요.' };
        }

        if (end <= start) {
          return { ok: false, message: '종료 시각은 시작 시각보다 뒤여야 합니다.' };
        }

        if (!isStartWithinBookingWindow(start, snapshot.settings, new Date())) {
          return {
            ok: false,
            message:
              '시작 날짜가 현재 예약 가능 범위를 벗어났습니다. 관리자 페이지에서 범위를 조정할 수 있습니다.',
          };
        }

        if (end > getLatestAllowedEnd(start, snapshot.settings)) {
          return {
            ok: false,
            message: `최대 사용 기간은 ${snapshot.settings.maxDurationDays}일입니다.`,
          };
        }

        const blockedDate = getCoveredDateKeys(start, end).find((dateKey) =>
          snapshot.blockedDates.includes(dateKey),
        );

        if (blockedDate) {
          return {
            ok: false,
            message: `${blockedDate}은 관리자에 의해 예약이 막혀 있습니다.`,
          };
        }

        const conflict = getConflictBooking(snapshot.bookings, start, end);

        if (conflict) {
          return {
            ok: false,
            message: `${conflict.applicant}님의 기존 예약과 시간이 겹칩니다.`,
          };
        }

        const createdAt = new Date();
        const newBooking: Booking = {
          id: `bk-${createdAt.getTime()}`,
          applicant: trimmedApplicant,
          channel,
          startAt,
          endAt,
          purpose: trimmedPurpose,
          status: 'active',
          createdAt: createdAt.toISOString(),
        };

        setSnapshot((current) => ({
          ...current,
          bookings: [...current.bookings, newBooking].sort(compareBookings),
        }));

        return {
          ok: true,
          message: `${trimmedApplicant}님의 예약이 등록되었습니다.`,
        };
      },
      updateBooking: ({ id, channel, startAt, endAt, purpose }) => {
        const target = snapshot.bookings.find((booking) => booking.id === id);

        if (!target) {
          return { ok: false, message: '수정할 예약을 찾을 수 없습니다.' };
        }

        const start = fromDateTimeLocal(startAt);
        const end = fromDateTimeLocal(endAt);

        if (!start || !end) {
          return { ok: false, message: '시작 시각과 종료 시각을 올바르게 입력해 주세요.' };
        }

        if (end <= start) {
          return { ok: false, message: '종료 시각은 시작 시각보다 뒤여야 합니다.' };
        }

        if (!isStartWithinBookingWindow(start, snapshot.settings, new Date())) {
          return {
            ok: false,
            message:
              '시작 날짜가 현재 예약 가능 범위를 벗어났습니다. 관리자 페이지에서 범위를 조정할 수 있습니다.',
          };
        }

        if (end > getLatestAllowedEnd(start, snapshot.settings)) {
          return {
            ok: false,
            message: `최대 사용 기간은 ${snapshot.settings.maxDurationDays}일입니다.`,
          };
        }

        const blockedDate = getCoveredDateKeys(start, end).find((dateKey) =>
          snapshot.blockedDates.includes(dateKey),
        );

        if (blockedDate) {
          return {
            ok: false,
            message: `${blockedDate}은 관리자에 의해 예약이 막혀 있습니다.`,
          };
        }

        const conflict = getConflictBooking(snapshot.bookings, start, end, id);

        if (conflict) {
          return {
            ok: false,
            message: `${conflict.applicant}님의 기존 예약과 시간이 겹칩니다.`,
          };
        }

        setSnapshot((current) => ({
          ...current,
          bookings: current.bookings
            .map((booking) =>
              booking.id === id
                ? {
                    ...booking,
                    channel,
                    startAt,
                    endAt,
                    purpose: purpose.trim(),
                  }
                : booking,
            )
            .sort(compareBookings),
        }));

        return {
          ok: true,
          message: `${target.applicant}님의 예약을 수정했습니다.`,
        };
      },
      cancelBooking: (id) => {
        setSnapshot((current) => ({
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === id ? { ...booking, status: 'cancelled' } : booking,
          ),
        }));
      },
      addBlockedDate: (date) => {
        const trimmed = date.trim();
        if (!trimmed) {
          return { ok: false, message: '차단할 날짜를 선택해 주세요.' };
        }

        if (snapshot.blockedDates.includes(trimmed)) {
          return { ok: false, message: '이미 차단된 날짜입니다.' };
        }

        setSnapshot((current) => ({
          ...current,
          blockedDates: [...current.blockedDates, trimmed].sort(),
        }));

        return { ok: true, message: `${trimmed}을 차단했습니다.` };
      },
      removeBlockedDate: (date) => {
        setSnapshot((current) => ({
          ...current,
          blockedDates: current.blockedDates.filter(
            (blockedDate) => blockedDate !== date,
          ),
        }));
      },
      addNotice: (notice) => {
        const trimmed = notice.trim();
        if (!trimmed) {
          return { ok: false, message: '공지 내용을 입력해 주세요.' };
        }

        setSnapshot((current) => ({
          ...current,
          notices: [trimmed, ...current.notices],
        }));

        return { ok: true, message: '공지사항을 추가했습니다.' };
      },
      removeNotice: (notice) => {
        setSnapshot((current) => ({
          ...current,
          notices: current.notices.filter((item) => item !== notice),
        }));
      },
      updateSettings: (next) => {
        if (
          !Number.isFinite(next.bookingWindowDays) ||
          !Number.isFinite(next.maxDurationDays)
        ) {
          return { ok: false, message: '숫자 형식의 값만 저장할 수 있습니다.' };
        }

        if (next.bookingWindowDays < 0) {
          return { ok: false, message: '예약 가능 범위는 0일 이상이어야 합니다.' };
        }

        if (next.maxDurationDays <= 0) {
          return { ok: false, message: '최대 사용 기간은 1일 이상이어야 합니다.' };
        }

        setSnapshot((current) => ({
          ...current,
          settings: {
            bookingWindowDays: Math.floor(next.bookingWindowDays),
            maxDurationDays: Math.floor(next.maxDurationDays),
          },
        }));

        return { ok: true, message: '예약 규칙을 저장했습니다.' };
      },
    }),
    [ready, snapshot],
  );

  return (
    <ReservationContext.Provider value={value}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const context = useContext(ReservationContext);

  if (!context) {
    throw new Error('useReservation must be used within ReservationProvider');
  }

  return context;
}
