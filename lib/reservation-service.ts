import {
  buildBookingSummary,
  compareBookings,
  compareChangeLogs,
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
} from './reservation-data';
import { getReservationStore } from './reservation-store';

export type ActionResult = {
  ok: boolean;
  message: string;
};

export type ReservationAction =
  | {
      type: 'addBookings';
      payload: {
        applicant: string;
        channels: Channel[];
        startAt: string;
        endAt: string;
        purpose: string;
      };
    }
  | {
      type: 'updateBooking';
      payload: {
        id: string;
        requestedBy: string;
        channel: Channel;
        startAt: string;
        endAt: string;
        purpose: string;
      };
    }
  | {
      type: 'cancelBooking';
      payload: { id: string; requestedBy: string };
    }
  | { type: 'addBlockedDate'; payload: { date: string } }
  | { type: 'removeBlockedDate'; payload: { date: string } }
  | { type: 'addNotice'; payload: { notice: string } }
  | { type: 'removeNotice'; payload: { notice: string } }
  | { type: 'updateSettings'; payload: ReservationSettings };

export type ReservationActionResponse = ActionResult & {
  snapshot: ReservationSnapshot;
};

const ADMIN_ACTIONS = new Set<ReservationAction['type']>([
  'addBlockedDate',
  'removeBlockedDate',
  'addNotice',
  'removeNotice',
  'updateSettings',
]);

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

function withSortedSnapshot(snapshot: ReservationSnapshot): ReservationSnapshot {
  return {
    ...snapshot,
    bookings: [...snapshot.bookings].sort(compareBookings),
    changeLogs: [...snapshot.changeLogs].sort(compareChangeLogs),
    blockedDates: [...snapshot.blockedDates].sort(),
  };
}

export async function readReservationSnapshot() {
  return withSortedSnapshot(
    pruneExpiredReservationState(await getReservationStore().readSnapshot()),
  );
}

function validateTimeRange(
  snapshot: ReservationSnapshot,
  startAt: string,
  endAt: string,
) {
  const start = fromDateTimeLocal(startAt);
  const end = fromDateTimeLocal(endAt);

  if (!start || !end) {
    return { ok: false as const, message: 'Enter a valid start and end time.' };
  }

  if (end <= start) {
    return { ok: false as const, message: 'End time must be after start time.' };
  }

  if (!isHourAlignedRange(start, end)) {
    return {
      ok: false as const,
      message:
        'Bookings must use 1-hour increments. Example: 13:00-18:00 is allowed, 13:00-18:30 is not.',
    };
  }

  if (!isStartWithinBookingWindow(start, snapshot.settings, new Date())) {
    return {
      ok: false as const,
      message:
        'The start date is outside the current booking window. You can adjust it on the admin page.',
    };
  }

  if (end > getLatestAllowedEnd(start, snapshot.settings)) {
    return {
      ok: false as const,
      message: `Maximum usage duration is ${snapshot.settings.maxDurationDays} days.`,
    };
  }

  const blockedDate = getBlockedDateInRange(snapshot.blockedDates, start, end);

  if (blockedDate) {
    return {
      ok: false as const,
      message: `${blockedDate} is blocked by the admin.`,
    };
  }

  return { ok: true as const, start, end };
}

async function response(
  result: ActionResult,
): Promise<ReservationActionResponse> {
  return {
    ...result,
    snapshot: await readReservationSnapshot(),
  };
}

export async function applyReservationAction(
  action: ReservationAction,
  options: { isAdmin: boolean },
): Promise<ReservationActionResponse> {
  if (ADMIN_ACTIONS.has(action.type) && !options.isAdmin) {
    return response({
      ok: false,
      message: 'Admin authentication is required for this action.',
    });
  }

  const store = getReservationStore();
  const snapshot = await readReservationSnapshot();

  switch (action.type) {
    case 'addBookings': {
      const { applicant, channels, startAt, endAt, purpose } = action.payload;
      const trimmedApplicant = applicant.trim();
      const trimmedPurpose = purpose.trim();
      const selectedChannels = Array.from(new Set(channels));

      if (!trimmedApplicant) {
        return response({ ok: false, message: 'User name is required.' });
      }

      if (selectedChannels.length === 0) {
        return response({ ok: false, message: 'Select at least one channel.' });
      }

      const range = validateTimeRange(snapshot, startAt, endAt);
      if (!range.ok) {
        return response(range);
      }

      const conflicts = selectedChannels
        .map((channel) => ({
          channel,
          booking: findActiveBookingConflict(
            snapshot.bookings,
            channel,
            range.start,
            range.end,
          ),
        }))
        .filter((item) => item.booking);

      if (conflicts.length > 0) {
        const conflictLabels = conflicts
          .map((item) => `${item.channel} (${item.booking?.applicant})`)
          .join(', ');
        return response({
          ok: false,
          message: `Selected channels overlap with existing bookings: ${conflictLabels}.`,
        });
      }

      const createdAt = new Date();
      const createdAtIso = createdAt.toISOString();
      const bookings: Booking[] = selectedChannels.map((channel, index) => ({
        id: `bk-${createdAt.getTime()}-${channel
          .replace(/\s+/g, '')
          .toLowerCase()}-${index}`,
        applicant: trimmedApplicant,
        channel,
        startAt,
        endAt,
        purpose: trimmedPurpose,
        status: 'active',
        createdAt: createdAtIso,
      }));
      const logs = bookings.map((booking) =>
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
      const mutation = await store.insertBookings(bookings, logs);

      if (!mutation.ok) {
        return response({
          ok: false,
          message: mutation.message ?? 'Failed to save booking.',
        });
      }

      return response({
        ok: true,
        message:
          selectedChannels.length === 1
            ? `${trimmedApplicant}'s booking has been saved.`
            : `${trimmedApplicant}'s bookings have been saved for ${selectedChannels.join(
                ', ',
              )}.`,
      });
    }

    case 'updateBooking': {
      const { id, requestedBy, channel, startAt, endAt, purpose } = action.payload;
      const target = snapshot.bookings.find((booking) => booking.id === id);

      if (!target) {
        return response({
          ok: false,
          message: 'Could not find the booking to edit.',
        });
      }

      const range = validateTimeRange(snapshot, startAt, endAt);
      if (!range.ok) {
        return response(range);
      }

      const conflict = findActiveBookingConflict(
        snapshot.bookings,
        channel,
        range.start,
        range.end,
        id,
      );

      if (conflict) {
        return response({
          ok: false,
          message: `This overlaps with ${conflict.applicant}'s existing booking.`,
        });
      }

      const nextBooking: Booking = {
        ...target,
        channel,
        startAt,
        endAt,
        purpose: purpose.trim(),
      };
      const log = createLogEntry(
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
      );
      const mutation = await store.updateBooking(nextBooking, log);

      if (!mutation.ok) {
        return response({
          ok: false,
          message: mutation.message ?? 'Failed to update booking.',
        });
      }

      return response({
        ok: true,
        message: `${target.applicant}'s booking has been updated.`,
      });
    }

    case 'cancelBooking': {
      const { id, requestedBy } = action.payload;
      const target = snapshot.bookings.find((booking) => booking.id === id);

      if (!target) {
        return response({
          ok: false,
          message: 'Could not find the booking to cancel.',
        });
      }

      const mutation = await store.cancelBooking(
        id,
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
      );

      return response({
        ok: mutation.ok,
        message: mutation.message ?? `${target.applicant}'s booking was cancelled.`,
      });
    }

    case 'addBlockedDate': {
      const date = action.payload.date.trim();
      if (!date) {
        return response({ ok: false, message: 'Select a date to block.' });
      }

      if (snapshot.blockedDates.includes(date)) {
        return response({ ok: false, message: 'This date is already blocked.' });
      }

      await store.addBlockedDate(
        date,
        createLogEntry('blocked_date_added', 'Admin', `${date} blocked`),
      );
      return response({ ok: true, message: `${date} has been blocked.` });
    }

    case 'removeBlockedDate': {
      const date = action.payload.date.trim();
      await store.removeBlockedDate(
        date,
        createLogEntry('blocked_date_removed', 'Admin', `${date} unblocked`),
      );
      return response({ ok: true, message: `${date} has been unblocked.` });
    }

    case 'addNotice': {
      const notice = action.payload.notice.trim();
      if (!notice) {
        return response({ ok: false, message: 'Enter notice content.' });
      }

      await store.addNotice(
        notice,
        createLogEntry('notice_added', 'Admin', `Notice added: ${notice}`),
      );
      return response({ ok: true, message: 'Notice has been added.' });
    }

    case 'removeNotice': {
      const notice = action.payload.notice;
      await store.removeNotice(
        notice,
        createLogEntry('notice_removed', 'Admin', `Notice removed: ${notice}`),
      );
      return response({ ok: true, message: 'Notice has been removed.' });
    }

    case 'updateSettings': {
      const next = action.payload;

      if (
        !Number.isFinite(next.bookingWindowDays) ||
        !Number.isFinite(next.maxDurationDays)
      ) {
        return response({
          ok: false,
          message: 'Only numeric values can be saved.',
        });
      }

      if (next.bookingWindowDays < 0) {
        return response({
          ok: false,
          message: 'Booking window must be 0 days or more.',
        });
      }

      if (next.maxDurationDays <= 0) {
        return response({
          ok: false,
          message: 'Maximum usage duration must be at least 1 day.',
        });
      }

      const settings = {
        bookingWindowDays: Math.floor(next.bookingWindowDays),
        maxDurationDays: Math.floor(next.maxDurationDays),
      };
      await store.updateSettings(
        settings,
        createLogEntry(
          'settings_updated',
          'Admin',
          `Booking window changed to ${settings.bookingWindowDays} days and maximum usage duration changed to ${settings.maxDurationDays} days`,
        ),
      );
      return response({ ok: true, message: 'Booking rules have been saved.' });
    }

    default:
      return response({ ok: false, message: 'Unsupported action.' });
  }
}
