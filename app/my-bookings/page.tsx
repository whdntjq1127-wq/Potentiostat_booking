'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useReservation } from '../../components/reservation-context';
import { useLanguage } from '../../components/language-context';
import { useBookingQueue } from '../../components/use-booking-queue';
import { BookingQueuePanel, QueueTimer, queueCopy } from '../../components/booking-queue-panel';
import {
  CHANNELS,
  addHours,
  formatBookingRange,
  fromDateTimeLocal,
  getBookingToday,
  getChannelColor,
  getLatestAllowedEnd,
  getLatestBookableDate,
  getStatusLabel,
  toDateTimeLocal,
  type Channel,
} from '../../lib/reservation-data';

type EditDraft = {
  channel: Channel;
  startAt: string;
  endAt: string;
  purpose: string;
};

export default function MyBookingsPage() {
  const queue = useBookingQueue();
  const { language } = useLanguage();
  const queueText = queueCopy[language];
  const [queueRequested, setQueueRequested] = useState(false);
  const [saving, setSaving] = useState(false);
  const { bookings, cancelBooking, ready, settings, updateBooking } = useReservation();
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [cancelPasswords, setCancelPasswords] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let timer: number;
    const syncNow = () => {
      window.clearTimeout(timer);
      const current = new Date();
      setNow(current);
      const delay = (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
      timer = window.setTimeout(syncNow, delay);
    };
    syncNow();
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', syncNow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', syncNow);
    };
  }, []);

  const editStart = editDraft ? fromDateTimeLocal(editDraft.startAt) : null;
  const firstStart = toDateTimeLocal(getBookingToday(now));
  const lastStart = toDateTimeLocal(addHours(getLatestBookableDate(settings, now), 23));
  const firstEnd = editStart ? toDateTimeLocal(addHours(editStart, 1)) : undefined;
  const lastEnd = editStart
    ? toDateTimeLocal(getLatestAllowedEnd(editStart, settings, now))
    : undefined;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return [];
    }

    return bookings.filter(
      (booking) => booking.applicant.trim().toLowerCase() === trimmed,
    );
  }, [bookings, query]);

  if (!ready) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">Loading</div>
          <h1 className="section-title">Preparing the booking list.</h1>
        </section>
      </main>
    );
  }

  function beginEdit(booking: (typeof bookings)[number]) {
    setEditingId(booking.id);
    setEditDraft({
      channel: booking.channel,
      startAt: booking.startAt,
      endAt: booking.endAt,
      purpose: booking.purpose,
    });
    setEditMessage(null);
  }

  async function closeEdit() {
    if (saving || queue.busy) return;
    if (queueRequested && !(await queue.leave())) return;
    setQueueRequested(false);
    setEditingId(null);
  }

  return (
    <main className="lookup-layout">
      {queueRequested ? <BookingQueuePanel queue={queue} onClose={() => void closeEdit()} /> : null}
      <section className="panel">
        <div className="eyebrow">Find My Bookings</div>
        <h1 className="section-title">Search Bookings by Name</h1>
        <p className="muted">
          This demo uses names instead of login. Enter the exact name used when the
          booking was created.
        </p>
        <p className="muted">
          Booking creation, edits, and cancellations are all recorded in the public
          logbook under Booking Change History.
        </p>

        <div className="lookup-bar section">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Dr. Kim"
          />
        </div>

        <div className="reservation-list section">
          {!query.trim() ? (
            <div className="empty-state">
              Enter a user name first to filter your bookings.
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">No bookings were found for this name.</div>
          ) : (
            filtered.map((booking) => (
              <article
                key={booking.id}
                className="reservation-card channel-card"
                style={
                  {
                    '--channel-color': getChannelColor(booking.channel),
                  } as CSSProperties
                }
              >
                <div className="card-head">
                  <div>
                    <strong>
                      {booking.applicant} · {booking.channel}
                    </strong>
                    <div className="muted">{formatBookingRange(booking.startAt, booking.endAt)}</div>
                  </div>
                  <span className="channel-badge">{booking.channel}</span>
                </div>

                <div className="card-head">
                  <span className={`status ${booking.status}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="muted">
                  {booking.purpose || 'This booking has no memo.'}
                </div>

                {booking.status === 'active' ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() =>
                        editingId === booking.id
                          ? void closeEdit()
                          : beginEdit(booking)
                      }
                    >
                      {editingId === booking.id ? 'Close Edit' : 'Edit Booking'}
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={async () => {
                        const result = await cancelBooking({
                          id: booking.id,
                          requestedBy: query.trim() || booking.applicant,
                          password: cancelPasswords[booking.id] ?? '',
                        });
                        setEditMessage(result.message);
                      if (result.ok) {
                        setCancelPasswords((current) => ({
                          ...current,
                          [booking.id]: '',
                        }));
                      }
                    }}
                    >
                      Cancel Booking
                    </button>
                  </div>
                ) : null}

                {booking.status === 'active' ? (
                  <div className="field">
                    <label htmlFor={`cancel-password-${booking.id}`}>
                      Cancellation Password (if set)
                    </label>
                    <input
                      id={`cancel-password-${booking.id}`}
                      type="password"
                      value={cancelPasswords[booking.id] ?? ''}
                      onChange={(event) =>
                        setCancelPasswords((current) => ({
                          ...current,
                          [booking.id]: event.target.value,
                        }))
                      }
                      placeholder="Leave blank if this booking has no password."
                    />
                  </div>
                ) : null}

                {editingId === booking.id && editDraft ? (
                  <form
                    className="form-grid section edit-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (saving) return;
                      if (!queue.canBook) {
                        setQueueRequested(true);
                        await queue.join();
                        return;
                      }
                      setSaving(true);
                      const result = await updateBooking({
                        id: booking.id,
                        requestedBy: query.trim() || booking.applicant,
                        channel: editDraft.channel,
                        startAt: editDraft.startAt,
                        endAt: editDraft.endAt,
                        purpose: editDraft.purpose,
                      });
                      setSaving(false);
                      await queue.refresh();
                      setEditMessage(result.message);
                      if (result.ok) {
                        setQueueRequested(false);
                        setEditingId(null);
                      }
                    }}
                  >
                    {queue.status?.state === 'active' ? <div className="full"><QueueTimer queue={queue} /></div> : null}
                    <div className="field">
                      <label htmlFor={`channel-${booking.id}`}>Channel</label>
                      <div className="channel-picker" role="group" aria-label="Channel">
                        {CHANNELS.map((channel) => (
                          <button type="button" key={channel}
                            className={`channel-toggle ${editDraft.channel === channel ? 'selected' : ''}`}
                            aria-pressed={editDraft.channel === channel}
                            style={{ '--channel-color': getChannelColor(channel) } as CSSProperties}
                            onClick={() => setEditDraft((current) => current ? { ...current, channel } : current)}>
                            {channel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor={`start-${booking.id}`}>Start Time</label>
                      <input
                        id={`start-${booking.id}`}
                        type="datetime-local"
                        step={3600}
                        min={firstStart}
                        max={lastStart}
                        value={editDraft.startAt}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  startAt: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`end-${booking.id}`}>End Time</label>
                      <input
                        id={`end-${booking.id}`}
                        type="datetime-local"
                        step={3600}
                        min={firstEnd}
                        max={lastEnd}
                        value={editDraft.endAt}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  endAt: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor={`purpose-${booking.id}`}>Memo</label>
                      <textarea
                        id={`purpose-${booking.id}`}
                        value={editDraft.purpose}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  purpose: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="inline-note">
                      Start and end times must use 1-hour increments. Example:
                      13:00-18:00 is allowed, 13:00-18:30 is not.
                      {' '}Bookings must end by midnight after the last bookable date (Korea time).
                    </div>

                    <div className="action-row">
                      <button className="button" type="submit" disabled={saving || queue.busy || !queue.status}>
                        {queue.canBook ? (language === 'ko' ? '변경 저장' : 'Save Changes') : queueText.book}
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        disabled={saving || queue.busy}
                        onClick={() => void closeEdit()}
                      >
                        Close
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>

        {editMessage ? <div className="inline-message section">{editMessage}</div> : null}
      </section>
    </main>
  );
}
