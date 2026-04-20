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
  buildBookingSummary,
  compareBookings,
  compareChangeLogs,
  createInitialReservationState,
  fromDateTimeLocal,
  getCoveredDateKeys,
  getLatestAllowedEnd,
  isStartWithinBookingWindow,
  overlaps,
  type Booking,
  type Channel,
  type ChangeLogEntry,
  type ReservationSettings,
  type ReservationSnapshot,
} from '../lib/reservation-data';

const STORAGE_KEY = 'potentiostat-booking-demo-v3';

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
  changeLogs: ChangeLogEntry[];
  addBooking: (input: {
    applicant: string;
    channel: Channel;
    startAt: string;
    endAt: string;
    purpose: string;
  }) => ActionResult;
  updateBooking: (input: {
    id: string;
    requestedBy: string;
    channel: Channel;
    startAt: string;
    endAt: string;
    purpose: string;
  }) => ActionResult;
  cancelBooking: (input: { id: string; requestedBy: string }) => void;
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
  channel: Channel,
  start: Date,
  end: Date,
  ignoreId?: string,
) {
  return bookings.find((booking) => {
    if (
      !isActive(booking) ||
      booking.id === ignoreId ||
      booking.channel !== channel
    ) {
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

function isHourAlignedRange(start: Date, end: Date) {
  if (
    start.getMinutes() !== 0 ||
    start.getSeconds() !== 0 ||
    start.getMilliseconds() !== 0 ||
    end.getMinutes() !== 0 ||
    end.getSeconds() !== 0 ||
    end.getMilliseconds() !== 0
  ) {
    return false;
  }

  const diff = end.getTime() - start.getTime();
  const oneHour = 60 * 60 * 1000;

  return diff >= oneHour && diff % oneHour === 0;
}

function createLogEntry(
  action: ChangeLogEntry['action'],
  actor: string,
  summary: string,
): ChangeLogEntry {
  const now = new Date();

  return {
    id: `log-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: actor.trim() || '알 수 없음',
    action,
    summary,
    createdAt: now.toISOString(),
  };
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ReservationSnapshot>(() =>
    createInitialReservationState(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = parseStoredState();
    if (stored) {
      const defaults = createInitialReservationState();
      setSnapshot({
        ...defaults,
        ...stored,
        bookings: [...stored.bookings].sort(compareBookings),
        blockedDates: stored.blockedDates ?? defaults.blockedDates,
        notices: stored.notices ?? defaults.notices,
        settings: stored.settings ?? defaults.settings,
        changeLogs: [...(stored.changeLogs ?? [])].sort(compareChangeLogs),
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
      changeLogs: snapshot.changeLogs,
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

        if (!isHourAlignedRange(start, end)) {
          return {
            ok: false,
            message: '예약은 1시간 단위로만 등록할 수 있습니다. 예: 13시~18시 가능, 13시~18시30분 불가',
          };
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

        const conflict = getConflictBooking(
          snapshot.bookings,
          channel,
          start,
          end,
        );

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
          changeLogs: [
            createLogEntry(
              'booking_created',
              trimmedApplicant,
              buildBookingSummary({
                channel,
                startAt,
                endAt,
                purpose: trimmedPurpose,
              }),
            ),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
        }));

        return {
          ok: true,
          message: `${trimmedApplicant}님의 예약이 등록되었습니다.`,
        };
      },
      updateBooking: ({ id, requestedBy, channel, startAt, endAt, purpose }) => {
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

        if (!isHourAlignedRange(start, end)) {
          return {
            ok: false,
            message: '예약은 1시간 단위로만 수정할 수 있습니다. 예: 13시~18시 가능, 13시~18시30분 불가',
          };
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

        const conflict = getConflictBooking(
          snapshot.bookings,
          channel,
          start,
          end,
          id,
        );

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
          changeLogs: [
            createLogEntry(
              'booking_updated',
              requestedBy,
              `${target.applicant} 예약 변경: ${buildBookingSummary({
                channel: target.channel,
                startAt: target.startAt,
                endAt: target.endAt,
                purpose: target.purpose,
              })} -> ${buildBookingSummary({
                channel,
                startAt,
                endAt,
                purpose,
              })}`,
            ),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
        }));

        return {
          ok: true,
          message: `${target.applicant}님의 예약을 수정했습니다.`,
        };
      },
      cancelBooking: ({ id, requestedBy }) => {
        const target = snapshot.bookings.find((booking) => booking.id === id);

        if (!target) {
          return;
        }

        setSnapshot((current) => ({
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === id ? { ...booking, status: 'cancelled' } : booking,
          ),
          changeLogs: [
            createLogEntry(
              'booking_cancelled',
              requestedBy,
              `${target.applicant} 예약 취소: ${buildBookingSummary({
                channel: target.channel,
                startAt: target.startAt,
                endAt: target.endAt,
                purpose: target.purpose,
              })}`,
            ),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
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
          changeLogs: [
            createLogEntry('blocked_date_added', '관리자', `${trimmed} 예약 차단`),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
        }));

        return { ok: true, message: `${trimmed}을 차단했습니다.` };
      },
      removeBlockedDate: (date) => {
        setSnapshot((current) => ({
          ...current,
          blockedDates: current.blockedDates.filter(
            (blockedDate) => blockedDate !== date,
          ),
          changeLogs: [
            createLogEntry('blocked_date_removed', '관리자', `${date} 차단 해제`),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
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
          changeLogs: [
            createLogEntry('notice_added', '관리자', `공지 추가: ${trimmed}`),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
        }));

        return { ok: true, message: '공지사항을 추가했습니다.' };
      },
      removeNotice: (notice) => {
        setSnapshot((current) => ({
          ...current,
          notices: current.notices.filter((item) => item !== notice),
          changeLogs: [
            createLogEntry('notice_removed', '관리자', `공지 삭제: ${notice}`),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
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
          changeLogs: [
            createLogEntry(
              'settings_updated',
              '관리자',
              `예약 시작 가능 범위 ${Math.floor(next.bookingWindowDays)}일, 최대 사용 기간 ${Math.floor(next.maxDurationDays)}일로 변경`,
            ),
            ...current.changeLogs,
          ].sort(compareChangeLogs),
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
