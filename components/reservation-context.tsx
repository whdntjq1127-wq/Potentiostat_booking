'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createInitialReservationState,
  type Booking,
  type Channel,
  type ChangeLogEntry,
  type ReservationSettings,
  type ReservationSnapshot,
} from '../lib/reservation-data';

type ActionResult = {
  ok: boolean;
  message: string;
};

type ActionResponse = ActionResult & {
  snapshot?: ReservationSnapshot;
};

type ReservationContextValue = {
  ready: boolean;
  bookings: Booking[];
  blockedDates: string[];
  notices: string[];
  settings: ReservationSettings;
  changeLogs: ChangeLogEntry[];
  error: string | null;
  refresh: () => Promise<void>;
  addBooking: (input: {
    applicant: string;
    channel: Channel;
    startAt: string;
    endAt: string;
    purpose: string;
  }) => Promise<ActionResult>;
  addBookings: (input: {
    applicant: string;
    channels: Channel[];
    startAt: string;
    endAt: string;
    purpose: string;
  }) => Promise<ActionResult>;
  updateBooking: (input: {
    id: string;
    requestedBy: string;
    channel: Channel;
    startAt: string;
    endAt: string;
    purpose: string;
  }) => Promise<ActionResult>;
  cancelBooking: (input: {
    id: string;
    requestedBy: string;
  }) => Promise<ActionResult>;
  addBlockedDate: (date: string) => Promise<ActionResult>;
  removeBlockedDate: (date: string) => Promise<ActionResult>;
  addNotice: (notice: string) => Promise<ActionResult>;
  removeNotice: (notice: string) => Promise<ActionResult>;
  updateSettings: (next: ReservationSettings) => Promise<ActionResult>;
};

const ReservationContext = createContext<ReservationContextValue | null>(null);
const LEGACY_STORAGE_KEYS = [
  'potentiostat-booking-demo-v3',
  'potentiostat-booking-demo-v2',
] as const;
const LEGACY_RECOVERY_MARKER = 'potentiostat-booking-legacy-recovered-v1';

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
}

function readLegacySnapshot() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = LEGACY_STORAGE_KEYS
      .map((key) => window.localStorage.getItem(key))
      .find((value) => !!value);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as ReservationSnapshot;
  } catch {
    return null;
  }
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ReservationSnapshot>(() =>
    createInitialReservationState(),
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/reservations', {
        cache: 'no-store',
      });
      const data = await readJson<ReservationSnapshot | { error?: string }>(
        response,
      );

      if (!response.ok) {
        throw new Error(
          data && 'error' in data && data.error
            ? data.error
            : 'Failed to load reservation data.',
        );
      }

      setSnapshot(data as ReservationSnapshot);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Failed to load reservation data.',
      );
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [ready, refresh]);

  const runAction = useCallback(
    async (
      type: string,
      payload: unknown,
    ): Promise<ActionResult> => {
      try {
        const response = await fetch('/api/reservations/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        });
        const data = await readJson<ActionResponse>(response);

        if (data?.snapshot) {
          setSnapshot(data.snapshot);
        }

        if (!data) {
          return {
            ok: false,
            message: 'The server returned an empty response.',
          };
        }

        setError(data.ok ? null : data.message);
        return { ok: data.ok, message: data.message };
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : 'Failed to save changes.';
        setError(message);
        return { ok: false, message };
      }
    },
    [],
  );

  useEffect(() => {
    if (!ready || typeof window === 'undefined') {
      return;
    }

    const marker = window.localStorage.getItem(LEGACY_RECOVERY_MARKER);
    if (marker === 'done' || marker === 'running') {
      return;
    }

    const legacySnapshot = readLegacySnapshot();
    if (!legacySnapshot || !Array.isArray(legacySnapshot.bookings)) {
      return;
    }

    const currentBookingIds = new Set(snapshot.bookings.map((booking) => booking.id));
    const hasMissingLegacyBookings = legacySnapshot.bookings.some(
      (booking) => booking?.id && !currentBookingIds.has(booking.id),
    );

    if (!hasMissingLegacyBookings) {
      window.localStorage.setItem(LEGACY_RECOVERY_MARKER, 'done');
      return;
    }

    window.localStorage.setItem(LEGACY_RECOVERY_MARKER, 'running');

    void (async () => {
      const result = await runAction('recoverLegacySnapshot', {
        snapshot: legacySnapshot,
      });

      if (result.ok) {
        window.localStorage.setItem(LEGACY_RECOVERY_MARKER, 'done');
        return;
      }

      window.localStorage.removeItem(LEGACY_RECOVERY_MARKER);
    })();
  }, [ready, runAction, snapshot.bookings]);

  const value = useMemo<ReservationContextValue>(
    () => ({
      ready,
      bookings: snapshot.bookings,
      blockedDates: snapshot.blockedDates,
      notices: snapshot.notices,
      settings: snapshot.settings,
      changeLogs: snapshot.changeLogs,
      error,
      refresh,
      addBookings: (input) =>
        runAction('addBookings', {
          applicant: input.applicant,
          channels: input.channels,
          startAt: input.startAt,
          endAt: input.endAt,
          purpose: input.purpose,
        }),
      addBooking: (input) =>
        runAction('addBookings', {
          applicant: input.applicant,
          channels: [input.channel],
          startAt: input.startAt,
          endAt: input.endAt,
          purpose: input.purpose,
        }),
      updateBooking: (input) =>
        runAction('updateBooking', {
          id: input.id,
          requestedBy: input.requestedBy,
          channel: input.channel,
          startAt: input.startAt,
          endAt: input.endAt,
          purpose: input.purpose,
        }),
      cancelBooking: (input) =>
        runAction('cancelBooking', {
          id: input.id,
          requestedBy: input.requestedBy,
        }),
      addBlockedDate: (date) => runAction('addBlockedDate', { date }),
      removeBlockedDate: (date) => runAction('removeBlockedDate', { date }),
      addNotice: (notice) => runAction('addNotice', { notice }),
      removeNotice: (notice) => runAction('removeNotice', { notice }),
      updateSettings: (next) => runAction('updateSettings', next),
    }),
    [error, ready, refresh, runAction, snapshot],
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
