import { existsSync } from 'fs';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  DEFAULT_SETTINGS,
  compareBookings,
  compareChangeLogs,
  createInitialReservationState,
  pruneExpiredReservationState,
  type Booking,
  type ChangeLogEntry,
  type ReservationSettings,
  type ReservationSnapshot,
} from './reservation-data';

type BookingRow = {
  id: string;
  applicant: string;
  channel: Booking['channel'];
  start_at: string;
  end_at: string;
  purpose: string | null;
  status: Booking['status'];
  created_at: string;
};

type ChangeLogRow = {
  id: string;
  actor: string;
  action: ChangeLogEntry['action'];
  summary: string;
  created_at: string;
  booking_id: string | null;
  expires_at: string | null;
};

type SettingsRow = {
  booking_window_days: number;
  max_duration_days: number;
};

type StoreMutationResult = {
  ok: boolean;
  message?: string;
};

type SupabaseKeyKind =
  | 'service-role-jwt'
  | 'low-privilege-jwt'
  | 'secret'
  | 'publishable'
  | 'unknown';

export type ReservationStore = {
  readSnapshot: () => Promise<ReservationSnapshot>;
  replaceSnapshot: (
    snapshot: ReservationSnapshot,
  ) => Promise<StoreMutationResult>;
  insertBookings: (
    bookings: Booking[],
    logs: ChangeLogEntry[],
  ) => Promise<StoreMutationResult>;
  updateBooking: (
    booking: Booking,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
  cancelBooking: (
    id: string,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
  addBlockedDate: (
    date: string,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
  removeBlockedDate: (
    date: string,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
  addNotice: (
    notice: string,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
  removeNotice: (
    notice: string,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
  updateSettings: (
    settings: ReservationSettings,
    log: ChangeLogEntry,
  ) => Promise<StoreMutationResult>;
};

declare global {
  // eslint-disable-next-line no-var
  var __potentiostatReservationSnapshot: ReservationSnapshot | undefined;
}

const RENDER_DISK_STORE_FILE = '/var/data/reservations.json';

let cachedStore:
  | {
      key: string;
      store: ReservationStore;
    }
  | undefined;

function getMemorySnapshot() {
  if (!globalThis.__potentiostatReservationSnapshot) {
    globalThis.__potentiostatReservationSnapshot = createInitialReservationState();
  }

  return globalThis.__potentiostatReservationSnapshot;
}

function setMemorySnapshot(snapshot: ReservationSnapshot) {
  globalThis.__potentiostatReservationSnapshot = snapshot;
}

function normalizeLocalDateTime(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : value;
}

function toBookingRow(booking: Booking) {
  return {
    id: booking.id,
    applicant: booking.applicant,
    channel: booking.channel,
    start_at: booking.startAt,
    end_at: booking.endAt,
    purpose: booking.purpose,
    status: booking.status,
    created_at: booking.createdAt,
  };
}

function fromBookingRow(row: BookingRow): Booking {
  return {
    id: row.id,
    applicant: row.applicant,
    channel: row.channel,
    startAt: normalizeLocalDateTime(row.start_at),
    endAt: normalizeLocalDateTime(row.end_at),
    purpose: row.purpose ?? '',
    status: row.status,
    createdAt: row.created_at,
  };
}

function toChangeLogRow(log: ChangeLogEntry) {
  return {
    id: log.id,
    actor: log.actor,
    action: log.action,
    summary: log.summary,
    created_at: log.createdAt,
    booking_id: log.bookingId ?? null,
    expires_at: log.expiresAt ?? null,
  };
}

function fromChangeLogRow(row: ChangeLogRow): ChangeLogEntry {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    summary: row.summary,
    createdAt: row.created_at,
    bookingId: row.booking_id ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

function isConflictError(message?: string) {
  return !!message && /overlap|exclusion|duplicate key|conflict/i.test(message);
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function getDefaultProductionStoreFile() {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  if (existsSync(dirname(RENDER_DISK_STORE_FILE))) {
    return RENDER_DISK_STORE_FILE;
  }

  return join(process.cwd(), 'data', 'reservations.json');
}

function decodeJwtPayload(token: string) {
  const segments = token.split('.');

  if (segments.length !== 3) {
    return null;
  }

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      role?: string;
    };
  } catch {
    return null;
  }
}

function getSupabaseKeyKind(key: string): SupabaseKeyKind {
  if (key.startsWith('sb_secret_')) {
    return 'secret';
  }

  if (key.startsWith('sb_publishable_')) {
    return 'publishable';
  }

  const payload = decodeJwtPayload(key);

  if (!payload?.role) {
    return 'unknown';
  }

  if (payload.role === 'service_role') {
    return 'service-role-jwt';
  }

  return 'low-privilege-jwt';
}

function getSupabaseConfigurationError(key: string) {
  const keyKind = getSupabaseKeyKind(key);

  if (keyKind === 'publishable' || keyKind === 'low-privilege-jwt') {
    return (
      'SUPABASE_SERVICE_ROLE_KEY is using a low-privilege Supabase key. ' +
      'Set it to the server-side service_role or secret key in Render and redeploy.'
    );
  }

  return null;
}

function explainSupabasePermissionError(message: string) {
  if (!/permission denied for table/i.test(message)) {
    return message;
  }

  const tableMatch = message.match(/permission denied for table ([a-zA-Z0-9_]+)/i);
  const tableName = tableMatch?.[1] ?? 'the requested table';

  return (
    `Supabase Data API does not have access to ${tableName}. ` +
    'Run the updated database/schema.sql in the Supabase SQL Editor to grant ' +
    'service_role access, then redeploy Render. Also verify that ' +
    'SUPABASE_SERVICE_ROLE_KEY is set to the Supabase service_role or secret key.'
  );
}

class MemoryReservationStore implements ReservationStore {
  async readSnapshot() {
    const pruned = pruneExpiredReservationState(getMemorySnapshot());
    setMemorySnapshot(pruned);
    return pruned;
  }

  async replaceSnapshot(snapshot: ReservationSnapshot) {
    setMemorySnapshot(pruneExpiredReservationState(snapshot));
    return { ok: true };
  }

  async insertBookings(bookings: Booking[], logs: ChangeLogEntry[]) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      bookings: [...current.bookings, ...bookings].sort(compareBookings),
      changeLogs: [...logs, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async updateBooking(booking: Booking, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      bookings: current.bookings
        .map((item) => (item.id === booking.id ? booking : item))
        .sort(compareBookings),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async cancelBooking(id: string, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      bookings: current.bookings.map((booking) =>
        booking.id === id ? { ...booking, status: 'cancelled' } : booking,
      ),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async addBlockedDate(date: string, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      blockedDates: [...current.blockedDates, date].sort(),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async removeBlockedDate(date: string, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      blockedDates: current.blockedDates.filter((item) => item !== date),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async addNotice(notice: string, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      notices: [notice, ...current.notices],
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async removeNotice(notice: string, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      notices: current.notices.filter((item) => item !== notice),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }

  async updateSettings(settings: ReservationSettings, log: ChangeLogEntry) {
    const current = await this.readSnapshot();
    setMemorySnapshot({
      ...current,
      settings,
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    });
    return { ok: true };
  }
}

class FileReservationStore implements ReservationStore {
  private readonly filePath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private queueTask<T>(task: () => Promise<T>) {
    const nextTask = this.queue.then(task, task);
    this.queue = nextTask.then(
      () => undefined,
      () => undefined,
    );
    return nextTask;
  }

  private async readSnapshotFile() {
    try {
      const contents = await readFile(this.filePath, 'utf8');
      return JSON.parse(contents) as ReservationSnapshot;
    } catch (error) {
      if (isMissingFileError(error)) {
        const initialSnapshot = createInitialReservationState();
        await this.writeSnapshotFile(initialSnapshot);
        return initialSnapshot;
      }

      throw error;
    }
  }

  private async writeSnapshotFile(snapshot: ReservationSnapshot) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    await rename(temporaryPath, this.filePath);
  }

  private async updateSnapshot(
    updater: (current: ReservationSnapshot) => ReservationSnapshot,
  ) {
    await this.queueTask(async () => {
      const current = pruneExpiredReservationState(await this.readSnapshotFile());
      await this.writeSnapshotFile(updater(current));
    });
    return { ok: true };
  }

  async readSnapshot() {
    return this.queueTask(async () => {
      const current = await this.readSnapshotFile();
      const pruned = pruneExpiredReservationState(current);
      await this.writeSnapshotFile(pruned);
      return pruned;
    });
  }

  async replaceSnapshot(snapshot: ReservationSnapshot) {
    return this.queueTask(async () => {
      await this.writeSnapshotFile(pruneExpiredReservationState(snapshot));
      return { ok: true };
    });
  }

  async insertBookings(bookings: Booking[], logs: ChangeLogEntry[]) {
    return this.updateSnapshot((current) => ({
      ...current,
      bookings: [...current.bookings, ...bookings].sort(compareBookings),
      changeLogs: [...logs, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async updateBooking(booking: Booking, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      bookings: current.bookings
        .map((item) => (item.id === booking.id ? booking : item))
        .sort(compareBookings),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async cancelBooking(id: string, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      bookings: current.bookings.map((booking) =>
        booking.id === id ? { ...booking, status: 'cancelled' } : booking,
      ),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async addBlockedDate(date: string, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      blockedDates: [...current.blockedDates, date].sort(),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async removeBlockedDate(date: string, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      blockedDates: current.blockedDates.filter((item) => item !== date),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async addNotice(notice: string, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      notices: [notice, ...current.notices],
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async removeNotice(notice: string, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      notices: current.notices.filter((item) => item !== notice),
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }

  async updateSettings(settings: ReservationSettings, log: ChangeLogEntry) {
    return this.updateSnapshot((current) => ({
      ...current,
      settings,
      changeLogs: [log, ...current.changeLogs].sort(compareChangeLogs),
    }));
  }
}

class SupabaseReservationStore implements ReservationStore {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(baseUrl: string, serviceKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.serviceKey = serviceKey;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    prefer?: string,
  ) {
    const response = await fetch(`${this.baseUrl}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        explainSupabasePermissionError(
          message || `Supabase request failed: ${response.status}`,
        ),
      );
    }

    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (null as T);
  }

  async readSnapshot() {
    const [bookingRows, logRows, blockedRows, noticeRows, settingsRows] =
      await Promise.all([
        this.request<BookingRow[]>('/pb_bookings?select=*&order=start_at.asc'),
        this.request<ChangeLogRow[]>('/pb_change_logs?select=*&order=created_at.desc'),
        this.request<Array<{ date: string }>>('/pb_blocked_dates?select=date&order=date.asc'),
        this.request<Array<{ notice: string }>>(
          '/pb_notices?select=notice,created_at&order=created_at.desc',
        ),
        this.request<SettingsRow[]>('/pb_settings?select=*&id=eq.default&limit=1'),
      ]);

    const snapshot = pruneExpiredReservationState({
      bookings: bookingRows.map(fromBookingRow).sort(compareBookings),
      changeLogs: logRows.map(fromChangeLogRow).sort(compareChangeLogs),
      blockedDates: blockedRows.map((row) => row.date).sort(),
      notices: noticeRows.map((row) => row.notice),
      settings: settingsRows[0]
        ? {
            bookingWindowDays: settingsRows[0].booking_window_days,
            maxDurationDays: settingsRows[0].max_duration_days,
          }
        : DEFAULT_SETTINGS,
    });

    await this.cleanupExpired(bookingRows, logRows, snapshot);
    return snapshot;
  }

  private async cleanupExpired(
    bookingRows: BookingRow[],
    logRows: ChangeLogRow[],
    snapshot: ReservationSnapshot,
  ) {
    const liveBookingIds = new Set(snapshot.bookings.map((booking) => booking.id));
    const liveLogIds = new Set(snapshot.changeLogs.map((log) => log.id));
    const removedBookingIds = bookingRows
      .map((booking) => booking.id)
      .filter((id) => !liveBookingIds.has(id));
    const removedLogIds = logRows
      .map((log) => log.id)
      .filter((id) => !liveLogIds.has(id));

    await Promise.all([
      this.deleteByIds('pb_bookings', removedBookingIds),
      this.deleteByIds('pb_change_logs', removedLogIds),
    ]);
  }

  private async deleteByIds(table: string, ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    const filter = ids.map(encodeURIComponent).join(',');
    await this.request(`/${table}?id=in.(${filter})`, { method: 'DELETE' });
  }

  async insertBookings(bookings: Booking[], logs: ChangeLogEntry[]) {
    try {
      await this.request('/pb_bookings', {
        method: 'POST',
        body: JSON.stringify(bookings.map(toBookingRow)),
      });
      await this.insertLogs(logs);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return {
        ok: false,
        message: isConflictError(message)
          ? 'One of the selected channels was just booked by another user.'
          : message || 'Failed to save booking.',
      };
    }
  }

  async replaceSnapshot(snapshot: ReservationSnapshot) {
    const next = pruneExpiredReservationState(snapshot);

    await Promise.all([
      this.request('/pb_bookings?id=not.is.null', { method: 'DELETE' }),
      this.request('/pb_change_logs?id=not.is.null', { method: 'DELETE' }),
      this.request('/pb_blocked_dates?date=not.is.null', { method: 'DELETE' }),
      this.request('/pb_notices?notice=not.is.null', { method: 'DELETE' }),
    ]);

    if (next.bookings.length > 0) {
      await this.request('/pb_bookings', {
        method: 'POST',
        body: JSON.stringify(next.bookings.map(toBookingRow)),
      });
    }

    if (next.changeLogs.length > 0) {
      await this.insertLogs(next.changeLogs);
    }

    if (next.blockedDates.length > 0) {
      await this.request('/pb_blocked_dates', {
        method: 'POST',
        body: JSON.stringify(next.blockedDates.map((date) => ({ date }))),
      });
    }

    if (next.notices.length > 0) {
      await this.request('/pb_notices', {
        method: 'POST',
        body: JSON.stringify(next.notices.map((notice) => ({ notice }))),
      });
    }

    await this.request(
      '/pb_settings',
      {
        method: 'POST',
        body: JSON.stringify({
          id: 'default',
          booking_window_days: next.settings.bookingWindowDays,
          max_duration_days: next.settings.maxDurationDays,
          updated_at: new Date().toISOString(),
        }),
      },
      'resolution=merge-duplicates',
    );

    return { ok: true };
  }

  async updateBooking(booking: Booking, log: ChangeLogEntry) {
    try {
      await this.request(`/pb_bookings?id=eq.${encodeURIComponent(booking.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(toBookingRow(booking)),
      });
      await this.insertLogs([log]);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return {
        ok: false,
        message: isConflictError(message)
          ? 'This booking now overlaps with another active booking.'
          : message || 'Failed to update booking.',
      };
    }
  }

  async cancelBooking(id: string, log: ChangeLogEntry) {
    await this.request(`/pb_bookings?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
    await this.insertLogs([log]);
    return { ok: true };
  }

  async addBlockedDate(date: string, log: ChangeLogEntry) {
    await this.request(
      '/pb_blocked_dates',
      {
        method: 'POST',
        body: JSON.stringify({ date }),
      },
      'resolution=merge-duplicates',
    );
    await this.insertLogs([log]);
    return { ok: true };
  }

  async removeBlockedDate(date: string, log: ChangeLogEntry) {
    await this.request(`/pb_blocked_dates?date=eq.${encodeURIComponent(date)}`, {
      method: 'DELETE',
    });
    await this.insertLogs([log]);
    return { ok: true };
  }

  async addNotice(notice: string, log: ChangeLogEntry) {
    await this.request(
      '/pb_notices',
      {
        method: 'POST',
        body: JSON.stringify({ notice }),
      },
      'resolution=merge-duplicates',
    );
    await this.insertLogs([log]);
    return { ok: true };
  }

  async removeNotice(notice: string, log: ChangeLogEntry) {
    await this.request(`/pb_notices?notice=eq.${encodeURIComponent(notice)}`, {
      method: 'DELETE',
    });
    await this.insertLogs([log]);
    return { ok: true };
  }

  async updateSettings(settings: ReservationSettings, log: ChangeLogEntry) {
    await this.request(
      '/pb_settings',
      {
        method: 'POST',
        body: JSON.stringify({
          id: 'default',
          booking_window_days: settings.bookingWindowDays,
          max_duration_days: settings.maxDurationDays,
          updated_at: new Date().toISOString(),
        }),
      },
      'resolution=merge-duplicates',
    );
    await this.insertLogs([log]);
    return { ok: true };
  }

  private async insertLogs(logs: ChangeLogEntry[]) {
    if (logs.length === 0) {
      return;
    }

    await this.request('/pb_change_logs', {
      method: 'POST',
      body: JSON.stringify(logs.map(toChangeLogRow)),
    });
  }
}

export function getReservationStore(): ReservationStore {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const filePath =
    process.env.RESERVATION_STORE_FILE?.trim() || getDefaultProductionStoreFile();
  const key =
    supabaseUrl && serviceKey
      ? `supabase:${supabaseUrl}`
      : filePath
        ? `file:${filePath}`
        : 'memory';

  if (cachedStore?.key === key) {
    return cachedStore.store;
  }

  let store: ReservationStore;

  if (supabaseUrl && serviceKey) {
    const configurationError = getSupabaseConfigurationError(serviceKey);

    if (configurationError) {
      throw new Error(configurationError);
    }

    store = new SupabaseReservationStore(supabaseUrl, serviceKey);
  } else if (filePath) {
    store = new FileReservationStore(filePath);
  } else {
    store = new MemoryReservationStore();
  }

  cachedStore = { key, store };
  return store;
}
