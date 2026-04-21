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
  addDays,
  buildBookingSummary,
  compareBookings,
  compareChangeLogs,
  createInitialReservationState,
  findActiveBookingConflict,
  fromDateTimeLocal,
  getBlockedDateInRange,
  getBookingExpiryDate,
  getLatestAllowedEnd,
  isStartWithinBookingWindow,
  pruneExpiredReservationState,
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
  addBookings: (input: {
    applicant: string;
    channels: Channel[];
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
  options?: {
    bookingId?: string;
    expiresAt?: string;
  },
): ChangeLogEntry {
  const now = new Date();

  return {
    id: `log-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: actor.trim() || 'Unknown',
    action,
    summary,
    createdAt: now.toISOString(),
    bookingId: options?.bookingId,
    expiresAt: options?.expiresAt,
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
      const migratedLogs = (stored.changeLogs ?? defaults.changeLogs).map((entry) => {
        if (entry.expiresAt) {
          return entry;
        }

        const linkedBooking = entry.bookingId
          ? stored.bookings.find((booking) => booking.id === entry.bookingId)
          : null;

        return {
          ...entry,
          expiresAt: linkedBooking
            ? getBookingExpiryDate(linkedBooking.endAt)?.toISOString()
            : addDays(new Date(entry.createdAt), 7).toISOString(),
        };
      });

      const nextSnapshot = {
        ...defaults,
        ...stored,
        bookings: [...stored.bookings].sort(compareBookings),
        blockedDates: stored.blockedDates ?? defaults.blockedDates,
        notices: stored.notices ?? defaults.notices,
        settings: stored.settings ?? defaults.settings,
        changeLogs: [...migratedLogs].sort(compareChangeLogs),
      };

      setSnapshot(pruneExpiredReservationState(nextSnapshot));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const interval = window.setInterval(() => {
      setSnapshot((current) => pruneExpiredReservationState(current));
    }, 60 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [ready, snapshot]);

  const value = useMemo<ReservationContextValue>(
    () => {
      const addBookings: ReservationContextValue['addBookings'] = ({
        applicant,
        channels,
        startAt,
        endAt,
        purpose,
      }) => {
        const trimmedApplicant = applicant.trim();
        const trimmedPurpose = purpose.trim();
        const selectedChannels = Array.from(new Set(channels));

        if (!trimmedApplicant) {
          return { ok: false, message: 'User name is required.' };
        }

        if (selectedChannels.length === 0) {
          return { ok: false, message: 'Select at least one channel.' };
        }

        const start = fromDateTimeLocal(startAt);
        const end = fromDateTimeLocal(endAt);

        if (!start || !end) {
          return { ok: false, message: 'Enter a valid start and end time.' };
        }

        if (end <= start) {
          return { ok: false, message: 'End time must be after start time.' };
        }

        if (!isHourAlignedRange(start, end)) {
          return {
            ok: false,
            message:
              'Bookings must use 1-hour increments. Example: 13:00-18:00 is allowed, 13:00-18:30 is not.',
          };
        }

        if (!isStartWithinBookingWindow(start, snapshot.settings, new Date())) {
          return {
            ok: false,
            message:
              'The start date is outside the current booking window. You can adjust it on the admin page.',
          };
        }

        if (end > getLatestAllowedEnd(start, snapshot.settings)) {
          return {
            ok: false,
            message: `Maximum usage duration is ${snapshot.settings.maxDurationDays} days.`,
          };
        }

        const blockedDate = getBlockedDateInRange(
          snapshot.blockedDates,
          start,
          end,
        );

        if (blockedDate) {
          return {
            ok: false,
            message: `${blockedDate} is blocked by the admin.`,
          };
        }

        const conflicts = selectedChannels
          .map((channel) => ({
            channel,
            booking: findActiveBookingConflict(
              snapshot.bookings,
              channel,
              start,
              end,
            ),
          }))
          .filter((item) => item.booking);

        if (conflicts.length > 0) {
          const conflictLabels = conflicts
            .map((item) => `${item.channel} (${item.booking?.applicant})`)
            .join(', ');
          return {
            ok: false,
            message: `Selected channels overlap with existing bookings: ${conflictLabels}.`,
          };
        }

        const createdAt = new Date();
        const createdAtIso = createdAt.toISOString();
        const newBookings: Booking[] = selectedChannels.map((channel, index) => ({
          id: `bk-${createdAt.getTime()}-${channel.replace(/\s+/g, '').toLowerCase()}-${index}`,
          applicant: trimmedApplicant,
          channel,
          startAt,
          endAt,
          purpose: trimmedPurpose,
          status: 'active',
          createdAt: createdAtIso,
        }));

        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);
          const newLogs = newBookings.map((booking) =>
            createLogEntry(
              'booking_created',
              trimmedApplicant,
              buildBookingSummary({
                channel: booking.channel,
                startAt,
                endAt,
                purpose: trimmedPurpose,
              }),
              {
                bookingId: booking.id,
                expiresAt: getBookingExpiryDate(endAt)?.toISOString(),
              },
            ),
          );

          return {
            ...base,
            bookings: [...base.bookings, ...newBookings].sort(compareBookings),
            changeLogs: [...newLogs, ...base.changeLogs].sort(compareChangeLogs),
          };
        });

        return {
          ok: true,
          message:
            selectedChannels.length === 1
              ? `${trimmedApplicant}'s booking has been saved.`
              : `${trimmedApplicant}'s bookings have been saved for ${selectedChannels.join(
                  ', ',
                )}.`,
        };
      };

      return {
        ready,
        bookings: snapshot.bookings,
        blockedDates: snapshot.blockedDates,
        notices: snapshot.notices,
        settings: snapshot.settings,
        changeLogs: snapshot.changeLogs,
        addBookings,
        addBooking: ({ applicant, channel, startAt, endAt, purpose }) =>
          addBookings({
            applicant,
            channels: [channel],
            startAt,
            endAt,
            purpose,
          }),
        updateBooking: ({ id, requestedBy, channel, startAt, endAt, purpose }) => {
        const target = snapshot.bookings.find((booking) => booking.id === id);

        if (!target) {
          return { ok: false, message: 'Could not find the booking to edit.' };
        }

        const start = fromDateTimeLocal(startAt);
        const end = fromDateTimeLocal(endAt);

        if (!start || !end) {
          return { ok: false, message: 'Enter a valid start and end time.' };
        }

        if (end <= start) {
          return { ok: false, message: 'End time must be after start time.' };
        }

        if (!isHourAlignedRange(start, end)) {
          return {
            ok: false,
            message:
              'Bookings can only be edited in 1-hour increments. Example: 13:00-18:00 is allowed, 13:00-18:30 is not.',
          };
        }

        if (!isStartWithinBookingWindow(start, snapshot.settings, new Date())) {
          return {
            ok: false,
            message:
              'The start date is outside the current booking window. You can adjust it on the admin page.',
          };
        }

        if (end > getLatestAllowedEnd(start, snapshot.settings)) {
          return {
            ok: false,
            message: `Maximum usage duration is ${snapshot.settings.maxDurationDays} days.`,
          };
        }

        const blockedDate = getBlockedDateInRange(
          snapshot.blockedDates,
          start,
          end,
        );

        if (blockedDate) {
          return {
            ok: false,
            message: `${blockedDate} is blocked by the admin.`,
          };
        }

        const conflict = findActiveBookingConflict(
          snapshot.bookings,
          channel,
          start,
          end,
          id,
        );

        if (conflict) {
          return {
            ok: false,
            message: `This overlaps with ${conflict.applicant}'s existing booking.`,
          };
        }

        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            bookings: base.bookings
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
                `${target.applicant} booking changed: ${buildBookingSummary({
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
                {
                  bookingId: id,
                  expiresAt: getBookingExpiryDate(endAt)?.toISOString(),
                },
              ),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });

        return {
          ok: true,
          message: `${target.applicant}'s booking has been updated.`,
        };
      },
      cancelBooking: ({ id, requestedBy }) => {
        const target = snapshot.bookings.find((booking) => booking.id === id);

        if (!target) {
          return;
        }

        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            bookings: base.bookings.map((booking) =>
              booking.id === id ? { ...booking, status: 'cancelled' } : booking,
            ),
            changeLogs: [
              createLogEntry(
                'booking_cancelled',
                requestedBy,
                `${target.applicant} booking cancelled: ${buildBookingSummary({
                  channel: target.channel,
                  startAt: target.startAt,
                  endAt: target.endAt,
                  purpose: target.purpose,
                })}`,
                {
                  bookingId: id,
                  expiresAt: getBookingExpiryDate(target.endAt)?.toISOString(),
                },
              ),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });
      },
      addBlockedDate: (date) => {
        const trimmed = date.trim();
        if (!trimmed) {
          return { ok: false, message: 'Select a date to block.' };
        }

        if (snapshot.blockedDates.includes(trimmed)) {
          return { ok: false, message: 'This date is already blocked.' };
        }

        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            blockedDates: [...base.blockedDates, trimmed].sort(),
            changeLogs: [
              createLogEntry('blocked_date_added', 'Admin', `${trimmed} blocked`),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });

        return { ok: true, message: `${trimmed} has been blocked.` };
      },
      removeBlockedDate: (date) => {
        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            blockedDates: base.blockedDates.filter(
              (blockedDate) => blockedDate !== date,
            ),
            changeLogs: [
              createLogEntry('blocked_date_removed', 'Admin', `${date} unblocked`),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });
      },
      addNotice: (notice) => {
        const trimmed = notice.trim();
        if (!trimmed) {
          return { ok: false, message: 'Enter notice content.' };
        }

        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            notices: [trimmed, ...base.notices],
            changeLogs: [
              createLogEntry('notice_added', 'Admin', `Notice added: ${trimmed}`),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });

        return { ok: true, message: 'Notice has been added.' };
      },
      removeNotice: (notice) => {
        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            notices: base.notices.filter((item) => item !== notice),
            changeLogs: [
              createLogEntry('notice_removed', 'Admin', `Notice removed: ${notice}`),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });
      },
      updateSettings: (next) => {
        if (
          !Number.isFinite(next.bookingWindowDays) ||
          !Number.isFinite(next.maxDurationDays)
        ) {
          return { ok: false, message: 'Only numeric values can be saved.' };
        }

        if (next.bookingWindowDays < 0) {
          return { ok: false, message: 'Booking window must be 0 days or more.' };
        }

        if (next.maxDurationDays <= 0) {
          return {
            ok: false,
            message: 'Maximum usage duration must be at least 1 day.',
          };
        }

        setSnapshot((current) => {
          const base = pruneExpiredReservationState(current);

          return {
            ...base,
            settings: {
              bookingWindowDays: Math.floor(next.bookingWindowDays),
              maxDurationDays: Math.floor(next.maxDurationDays),
            },
            changeLogs: [
              createLogEntry(
                'settings_updated',
                'Admin',
                `Booking window changed to ${Math.floor(
                  next.bookingWindowDays,
                )} days and maximum usage duration changed to ${Math.floor(
                  next.maxDurationDays,
                )} days`,
              ),
              ...base.changeLogs,
            ].sort(compareChangeLogs),
          };
        });

        return { ok: true, message: 'Booking rules have been saved.' };
      },
      };
    },
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
