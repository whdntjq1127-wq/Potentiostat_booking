'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useReservation } from '../components/reservation-context';
import { WeeklySchedule, type SelectedSlot } from '../components/weekly-schedule';
import {
  addDays,
  formatDateLabel,
  formatDateTimeLabel,
  formatDisplayTime,
  getChangeActionLabel,
  getLatestBookableDate,
  addHours,
  formatShortDateLabel,
  getCoveredDateKeys,
  getLatestAllowedEnd,
  overlaps,
  toDateKey,
} from '../lib/reservation-data';

type EndOption = {
  value: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
};

export default function Home() {
  const { ready, addBooking, bookings, blockedDates, changeLogs, settings } =
    useReservation();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [applicant, setApplicant] = useState('');
  const [purpose, setPurpose] = useState('');
  const [endAt, setEndAt] = useState('');
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    const syncNow = () => {
      const current = new Date();
      setNow(current);
      setWeekAnchor((existing) => existing ?? current);
      setMounted(true);
    };

    syncNow();

    const startMinuteTimer = () => {
      const current = new Date();
      const delay =
        (60 - current.getSeconds()) * 1000 - current.getMilliseconds();

      timeoutId = window.setTimeout(() => {
        syncNow();
        intervalId = window.setInterval(syncNow, 60 * 1000);
      }, delay);
    };

    startMinuteTimer();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    setApplicant('');
    setPurpose('');
    setEndAt(selectedSlot.endAt);
  }, [selectedSlot]);

  const availableEndOptions = useMemo<EndOption[]>(() => {
    if (!selectedSlot) {
      return [];
    }

    const start = new Date(selectedSlot.startAt);
    const latestEnd = getLatestAllowedEnd(start, settings);
    const options: EndOption[] = [];

    for (
      let candidate = addHours(start, 1);
      candidate <= latestEnd;
      candidate = addHours(candidate, 1)
    ) {
      const blockedDate = getCoveredDateKeys(start, candidate).find((dateKey) =>
        blockedDates.includes(dateKey),
      );

      if (blockedDate) {
        break;
      }

      const hasConflict = bookings.some((booking) => {
        if (booking.status !== 'active' || booking.channel !== selectedSlot.channel) {
          return false;
        }

        return overlaps(
          start,
          candidate,
          new Date(booking.startAt),
          new Date(booking.endAt),
        );
      });

      if (hasConflict) {
        break;
      }

      options.push({
        value: `${toDateKey(candidate)}T${String(candidate.getHours()).padStart(2, '0')}:00`,
        dateKey: toDateKey(candidate),
        dateLabel: formatShortDateLabel(candidate),
        timeLabel: formatDisplayTime(candidate),
      });
    }

    return options;
  }, [blockedDates, bookings, selectedSlot, settings]);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    if (availableEndOptions.length === 0) {
      setEndAt('');
      return;
    }

    if (!availableEndOptions.some((option) => option.value === endAt)) {
      setEndAt(availableEndOptions[0].value);
    }
  }, [availableEndOptions, endAt, selectedSlot]);

  if (!ready || !mounted || !now || !weekAnchor) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">Loading</div>
          <h1 className="section-title">Preparing the weekly booking board.</h1>
        </section>
      </main>
    );
  }

  const latestBookableDate = getLatestBookableDate(settings, now);
  const selectedEndDate = endAt ? endAt.split('T')[0] : '';
  const endDateOptions = availableEndOptions.filter(
    (option, index, list) =>
      list.findIndex((candidate) => candidate.dateKey === option.dateKey) === index,
  );
  const endTimeOptions = availableEndOptions.filter(
    (option) => option.dateKey === selectedEndDate,
  );
  const recentLogs = changeLogs.slice(0, 12);

  return (
    <main className="calendar-page">
      <section className="panel board-panel calendar-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">Weekly Calendar</div>
              <h2 className="section-title">7-Day Booking Status</h2>
            </div>
            <div className="rule-summary">
              <span>As of {formatDateLabel(now)}</span>
              <span>
                Last start date: {formatDateLabel(latestBookableDate)}
              </span>
              <span>Booking unit: 1-hour increments</span>
              <span>
                <Link href="/my-bookings">View My Bookings</Link>
              </span>
            </div>
          </div>

          {message ? (
            <div className={`inline-message ${message.ok ? 'success' : 'error'}`}>
              {message.text}
            </div>
          ) : null}

          <WeeklySchedule
            anchorDate={weekAnchor}
            now={now}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => {
              setSelectedSlot(slot);
              setMessage(null);
            }}
            onShiftWeek={(direction) =>
              setWeekAnchor((current) =>
                current ? addDays(current, direction * 7) : current,
              )
            }
          />
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Public Logbook</div>
            <h2 className="section-title">Booking Change History</h2>
          </div>
          <div className="muted">
            Booking creation, edits, cancellations, and admin changes are all recorded.
          </div>
        </div>

        <div className="logbook-list section">
          {recentLogs.length === 0 ? (
            <div className="empty-state">No changes have been recorded yet.</div>
          ) : (
            recentLogs.map((entry) => (
              <article key={entry.id} className="log-entry">
                <div className="card-head">
                  <div className="log-meta">
                    <span className="log-actor">{entry.actor}</span>
                    <span className="muted">{formatDateTimeLabel(entry.createdAt)}</span>
                  </div>
                  <span className="chip">{getChangeActionLabel(entry.action)}</span>
                </div>
                <div>{entry.summary}</div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedSlot ? (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <div>
                <div className="eyebrow">Create Booking</div>
                <h2 className="section-title">Book the Selected Slot</h2>
              </div>
              <button
                type="button"
                className="button-ghost"
                onClick={() => setSelectedSlot(null)}
              >
                Close
              </button>
            </div>

            <div className="selection-card modal-selection">
              <strong>{selectedSlot.channel}</strong>
              <span>Start: {formatDateTimeLabel(selectedSlot.startAt)}</span>
              <span>End: {formatDateTimeLabel(endAt || selectedSlot.endAt)}</span>
            </div>

            <form
              className="form-grid section"
              onSubmit={(event) => {
                event.preventDefault();

                const result = addBooking({
                  applicant,
                  channel: selectedSlot.channel,
                  startAt: selectedSlot.startAt,
                  endAt,
                  purpose,
                });

                setMessage({ ok: result.ok, text: result.message });

                if (result.ok) {
                  setSelectedSlot(null);
                  setApplicant('');
                  setPurpose('');
                  setEndAt('');
                }
              }}
            >
              <div className="field full">
                <label htmlFor="modal-applicant">User Name</label>
                <input
                  id="modal-applicant"
                  type="text"
                  value={applicant}
                  onChange={(event) => setApplicant(event.target.value)}
                  placeholder="e.g. Dr. Kim"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="modal-start">Equipment Start</label>
                <input
                  id="modal-start"
                  type="datetime-local"
                  value={selectedSlot.startAt}
                  readOnly
                />
              </div>

              <div className="field">
                <label htmlFor="modal-end-date">Equipment End</label>
                <div className="end-picker-grid">
                  <select
                    id="modal-end-date"
                    value={selectedEndDate}
                    onChange={(event) => {
                      const nextOption = availableEndOptions.find(
                        (option) => option.dateKey === event.target.value,
                      );

                      if (nextOption) {
                        setEndAt(nextOption.value);
                      }
                    }}
                    required
                  >
                    {endDateOptions.map((option) => (
                      <option key={option.dateKey} value={option.dateKey}>
                        {option.dateLabel}
                      </option>
                    ))}
                  </select>

                  <select
                    value={endAt}
                    onChange={(event) => setEndAt(event.target.value)}
                    required
                  >
                    {endTimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.timeLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field full">
                <label htmlFor="modal-purpose">Memo</label>
                <textarea
                  id="modal-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="Add experiment notes or handoff details."
                />
              </div>

              <div className="inline-note full-line">
                The start time is fixed to the slot you clicked. The end time can only
                be set in 1-hour increments, up to {settings.maxDurationDays} days
                from the start time.
              </div>

              <div className="action-row">
                <button className="button" type="submit">
                  Save Booking
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setSelectedSlot(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
