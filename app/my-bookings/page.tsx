'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useReservation } from '../../components/reservation-context';
import {
  CHANNELS,
  addHours,
  formatBookingRange,
  getChannelColor,
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
  const { bookings, cancelBooking, ready, updateBooking } = useReservation();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);

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

  return (
    <main className="lookup-layout">
      <section className="panel">
        <div className="eyebrow">Find My Bookings</div>
        <h1 className="section-title">Search Bookings by Name</h1>
        <p className="muted">
          This demo uses names instead of login. Enter the exact name used when the
          booking was created.
        </p>
        <p className="muted">
          Booking creation, edits, and cancellations are all recorded in the public
          logbook on the main page.
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
                          ? setEditingId(null)
                          : beginEdit(booking)
                      }
                    >
                      {editingId === booking.id ? 'Close Edit' : 'Edit Booking'}
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() =>
                        cancelBooking({
                          id: booking.id,
                          requestedBy: query.trim() || booking.applicant,
                        })
                      }
                    >
                      Cancel Booking
                    </button>
                  </div>
                ) : null}

                {editingId === booking.id && editDraft ? (
                  <form
                    className="form-grid section edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const result = updateBooking({
                        id: booking.id,
                        requestedBy: query.trim() || booking.applicant,
                        channel: editDraft.channel,
                        startAt: editDraft.startAt,
                        endAt: editDraft.endAt,
                        purpose: editDraft.purpose,
                      });
                      setEditMessage(result.message);
                      if (result.ok) {
                        setEditingId(null);
                      }
                    }}
                  >
                    <div className="field">
                      <label htmlFor={`channel-${booking.id}`}>Channel</label>
                      <select
                        id={`channel-${booking.id}`}
                        value={editDraft.channel}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  channel: event.target.value as Channel,
                                }
                              : current,
                          )
                        }
                      >
                        {CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor={`start-${booking.id}`}>Start Time</label>
                      <input
                        id={`start-${booking.id}`}
                        type="datetime-local"
                        step={3600}
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
                        min={toDateTimeLocal(
                          addHours(new Date(editDraft.startAt), 1),
                        )}
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
                    </div>

                    <div className="action-row">
                      <button className="button" type="submit">
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => setEditingId(null)}
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
