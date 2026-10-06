'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  formatDateLabelForLanguage,
  formatDateTimeLabelForLanguage,
  formatShortDateLabelForLanguage,
} from '../lib/i18n';
import { useLanguage } from '../components/language-context';
import { useReservation } from '../components/reservation-context';
import { useBookingQueue } from '../components/use-booking-queue';
import { BookingQueuePanel, QueueTimer, queueCopy } from '../components/booking-queue-panel';
import { WeeklySchedule, type SelectedSlot } from '../components/weekly-schedule';
import {
  CHANNELS,
  addDays,
  formatDisplayTime,
  findActiveBookingConflict,
  getBlockedDateInRange,
  getChannelColor,
  getLatestBookableDate,
  addHours,
  getLatestAllowedEnd,
  isStartWithinBookingWindow,
  toDateKey,
  type Booking,
  type Channel,
} from '../lib/reservation-data';

type EndOption = {
  value: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
};

const QUEUE_SELECTION_KEY = 'potentiostat-queue-selection-v1';
const QUEUE_ENTRY_KEY = 'potentiostat-queue-entry-v1';

export default function Home() {
  const {
    ready,
    addBookings,
    bookings,
    blockedDates,
    notices,
    settings,
    cancelBooking,
    refresh,
  } = useReservation();
  const { copy, language } = useLanguage();
  const queue = useBookingQueue();
  const queueText = queueCopy[language];
  const [bookingRequested, setBookingRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
  const [applicant, setApplicant] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bookingPassword, setBookingPassword] = useState('');
  const [endAt, setEndAt] = useState('');
  const [cancellingBookings, setCancellingBookings] = useState<Booking[]>([]);
  const [cancelPassword, setCancelPassword] = useState('');
  const [cancelMessage, setCancelMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(QUEUE_ENTRY_KEY) === 'entered') setBookingRequested(true);
      const saved = JSON.parse(sessionStorage.getItem(QUEUE_SELECTION_KEY) ?? 'null');
      if (saved && CHANNELS.includes(saved.channel) && typeof saved.startAt === 'string' && typeof saved.endAt === 'string'
        && (!saved.channels || (Array.isArray(saved.channels) && saved.channels.every((channel: Channel) => CHANNELS.includes(channel))))) {
        setSelectedSlot(saved);
        setEndAt(saved.endAt);
        setBookingRequested(true);
      }
    } catch { /* Storage is optional; the queue cookie remains server-owned. */ }
  }, []);

  useEffect(() => {
    if (queue.status?.state === 'active') void refresh();
    if (queue.status?.state === 'expired' || queue.status?.state === 'cancelled') {
      setSelectedSlot(null);
      setEndAt('');
      try { sessionStorage.removeItem(QUEUE_SELECTION_KEY); } catch { /* Optional. */ }
    }
  }, [queue.status?.state, refresh]);

  async function startBooking() {
    if (submitting || queue.busy || !ready) return;
    setBookingRequested(true);
    setSelectedSlot(null);
    setEndAt('');
    setMessage(null);
    try {
      sessionStorage.setItem(QUEUE_ENTRY_KEY, 'entered');
      sessionStorage.removeItem(QUEUE_SELECTION_KEY);
    } catch { /* Optional. */ }
    await queue.join();
  }

  function dismissBookingForm() {
    if (submitting) return;
    setSelectedSlot(null);
    setEndAt('');
    setMessage(null);
    try { sessionStorage.removeItem(QUEUE_SELECTION_KEY); } catch { /* Optional. */ }
  }

  async function exitBooking() {
    if (submitting || queue.busy) return;
    const result = await queue.leave();
    if (!result) return;
    setBookingRequested(false);
    setSelectedSlot(null);
    setEndAt('');
    setCancellingBookings([]);
    try {
      sessionStorage.removeItem(QUEUE_ENTRY_KEY);
      sessionStorage.removeItem(QUEUE_SELECTION_KEY);
    } catch { /* Optional. */ }
  }

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
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', syncNow);

    return () => {
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', syncNow);
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
      setSelectedChannels([]);
      return;
    }

    setSelectedChannels(selectedSlot.channels ?? [selectedSlot.channel]);
    setApplicant('');
    setPurpose('');
    setBookingPassword('');
  }, [selectedSlot]);

  const availableEndOptions = useMemo<EndOption[]>(() => {
    if (!selectedSlot || !now) {
      return [];
    }

    const start = new Date(selectedSlot.startAt);
    if (!isStartWithinBookingWindow(start, settings, now)) {
      return [];
    }
    const latestEnd = getLatestAllowedEnd(start, settings, now);
    const options: EndOption[] = [];

    for (
      let candidate = addHours(start, 1);
      candidate <= latestEnd;
      candidate = addHours(candidate, 1)
    ) {
      const blockedDate = getBlockedDateInRange(blockedDates, start, candidate);

      if (blockedDate) {
        break;
      }

      const hasConflict = selectedChannels.some(
        (channel) =>
          findActiveBookingConflict(
            bookings,
            channel,
            start,
            candidate,
          ),
      );

      if (hasConflict) {
        break;
      }

      options.push({
        value: `${toDateKey(candidate)}T${String(candidate.getHours()).padStart(2, '0')}:00`,
        dateKey: toDateKey(candidate),
        dateLabel: formatShortDateLabelForLanguage(candidate, language),
        timeLabel: formatDisplayTime(candidate),
      });
    }

    return options;
  }, [blockedDates, bookings, language, now, selectedSlot, selectedChannels, settings]);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    if (availableEndOptions.length === 0) {
      setEndAt('');
      return;
    }

    setEndAt((current) => {
      if (availableEndOptions.some((option) => option.value === current)) {
        return current;
      }

      if (
        availableEndOptions.some(
          (option) => option.value === selectedSlot.endAt,
        )
      ) {
        return selectedSlot.endAt;
      }

      return availableEndOptions[0].value;
    });
  }, [availableEndOptions, selectedSlot]);

  const selectedRange = useMemo(() => {
    if (!selectedSlot || !endAt) {
      return null;
    }

    const start = new Date(selectedSlot.startAt);
    const end = new Date(endAt);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return null;
    }

    return { start, end };
  }, [endAt, selectedSlot]);

  const channelAvailability = useMemo(
    () =>
      CHANNELS.map((channel) => ({
        channel,
        conflict: selectedRange
          ? findActiveBookingConflict(
              bookings,
              channel,
              selectedRange.start,
              selectedRange.end,
            )
          : undefined,
      })),
    [bookings, selectedRange],
  );

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    const unavailableChannels = new Set(
      channelAvailability
        .filter((item) => item.conflict)
        .map((item) => item.channel),
    );

    setSelectedChannels((current) =>
      current.filter((channel) => !unavailableChannels.has(channel)),
    );
  }, [channelAvailability, selectedSlot]);

  if (!ready || !mounted || !now || !weekAnchor || !bookingRequested || (!queue.canBook && !submitting)) {
    return (
      <main className="booking-entry-page">
        <section className="booking-start" aria-label={queueText.book}>
          <button type="button" className="booking-start-button" onClick={() => void startBooking()}
            disabled={!ready || !mounted || !queue.status || submitting || queue.busy}
            aria-busy={!queue.status || queue.busy}>
            <span>{queueText.book}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </button>
          {message ? <p role="status" className={`inline-message ${message.ok ? 'success' : 'error'}`}>{message.text}</p> : null}
          {queue.error && !bookingRequested ? <p role="alert" className="inline-message error">{queueText.error}</p> : null}
        </section>
        {bookingRequested && !submitting ? <BookingQueuePanel queue={queue} onClose={() => void exitBooking()} /> : null}
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
  const selectedChannelSet = new Set(selectedChannels);
  const selectedChannelLabel =
    selectedChannels.length > 0
      ? selectedChannels.join(', ')
      : copy.home.noChannelSelected;
  const cancellingBooking = cancellingBookings[0] ?? null;
  const setCancellingBooking = (booking: Booking | null) => {
    setCancellingBookings(booking ? [booking] : []);
  };
  const canSaveBooking = selectedChannels.length > 0 && !!endAt;
  const toggleChannel = (channel: Channel) => {
    const availability = channelAvailability.find(
      (item) => item.channel === channel,
    );

    if (availability?.conflict) {
      return;
    }

    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  };

  return (
    <main className="calendar-page">
      <section className="panel board-panel calendar-panel">
          <div className="section-head">
            <div className="calendar-title-block">
              <div className="eyebrow">{copy.home.weeklyEyebrow}</div>
              <h2 className="section-title">{copy.home.weeklyTitle}</h2>
            </div>
            {notices.length > 0 ? (
              <aside className="calendar-notice-panel" aria-label="관리자 공지사항">
                <div className="calendar-notice-heading">관리자 공지사항</div>
                <div className="calendar-notice-list">
                  {notices.map((notice, index) => (
                    <div
                      key={`${index}-${notice}`}
                      className="calendar-notice-entry"
                    >
                      {notice}
                    </div>
                  ))}
                </div>
              </aside>
            ) : null}
            <div className="rule-summary">
              <span>
                {copy.home.asOf(formatDateLabelForLanguage(now, language))}
              </span>
              <span>
                {copy.home.lastStartDate(
                  formatDateLabelForLanguage(latestBookableDate, language),
                )}
              </span>
              <span>{copy.home.bookingUnit}</span>
              <span>
                <Link href="/my-bookings">{copy.home.viewMyBookings}</Link>
              </span>
            </div>
          </div>

          {message ? (
            <div className={`inline-message ${message.ok ? 'success' : 'error'}`}>
              {message.text}
            </div>
          ) : null}

          <div className="booking-session-bar">
            <span>{queueText.select}</span>
            <QueueTimer queue={queue} />
            <button type="button" className="button-ghost" onClick={() => void exitBooking()}
              disabled={submitting || queue.busy}>
              {queueText.exit}
            </button>
          </div>

          <WeeklySchedule
            anchorDate={weekAnchor}
            now={now}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => {
              if (!queue.canBook || submitting) return;
              setSelectedSlot(slot);
              setEndAt(slot.endAt);
              setMessage(null);
              try { sessionStorage.setItem(QUEUE_SELECTION_KEY, JSON.stringify(slot)); } catch { /* Optional. */ }
            }}
            onCancelBooking={(booking) => {
              setCancellingBookings([booking]);
              setCancelPassword('');
              setCancelMessage(null);
              setSelectedSlot(null);
            }}
            onCancelBookings={(nextBookings) => {
              setCancellingBookings(nextBookings);
              setCancelPassword('');
              setCancelMessage(null);
              setSelectedSlot(null);
            }}
            onShiftWeek={(direction) =>
              setWeekAnchor((current) =>
                current ? addDays(current, direction * 7) : current,
              )
            }
          />
      </section>

      {selectedSlot && bookingRequested && (queue.canBook || submitting) ? (
        <div className="modal-overlay" onClick={dismissBookingForm}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-form-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === 'Escape') dismissBookingForm(); }}
          >
            <div className="section-head">
              <div>
                <div className="eyebrow">{copy.home.createEyebrow}</div>
                <h2 className="section-title" id="booking-form-title">{copy.home.createTitle}</h2>
              </div>
              <button
                type="button"
                className="button-ghost"
                disabled={submitting || queue.busy}
                onClick={dismissBookingForm}
              >
                {copy.home.close}
              </button>
            </div>

            <QueueTimer queue={queue} />
            {message && !message.ok ? <p role="alert" className="inline-message error">{message.text}</p> : null}
            <div className="selection-card modal-selection">
              <strong>{selectedChannelLabel}</strong>
              <span>
                {copy.home.start}:{' '}
                {formatDateTimeLabelForLanguage(selectedSlot.startAt, language)}
              </span>
              <span>
                {copy.home.end}:{' '}
                {formatDateTimeLabelForLanguage(
                  endAt || selectedSlot.endAt,
                  language,
                )}
              </span>
            </div>

            <form
              className="form-grid section"
              onSubmit={async (event) => {
                event.preventDefault();
                if (submitting || !queue.canBook) return;
                setSubmitting(true);
                const result = await addBookings({
                  applicant,
                  channels: selectedChannels,
                  startAt: selectedSlot.startAt,
                  endAt,
                  purpose,
                  password: bookingPassword,
                });
                setSubmitting(false);
                setMessage({ ok: result.ok, text: result.message });
                await queue.refresh();

                if (result.ok) {
                  setBookingRequested(false);
                  try {
                    sessionStorage.removeItem(QUEUE_ENTRY_KEY);
                    sessionStorage.removeItem(QUEUE_SELECTION_KEY);
                  } catch { /* Optional. */ }
                  setSelectedSlot(null);
                  setSelectedChannels([]);
                  setApplicant('');
                  setPurpose('');
                  setBookingPassword('');
                  setEndAt('');
                }
              }}
            >
              <div className="field full">
                <label htmlFor="modal-applicant">{copy.home.userName}</label>
                <input
                  id="modal-applicant"
                  type="text"
                  value={applicant}
                  onChange={(event) => setApplicant(event.target.value)}
                  placeholder={copy.home.applicantPlaceholder}
                  autoFocus
                  required
                />
              </div>

              <div className="field full">
                <label htmlFor="modal-password">
                  {queueText.password}
                </label>
                <input
                  id="modal-password"
                  type="password"
                  value={bookingPassword}
                  onChange={(event) => setBookingPassword(event.target.value)}
                  placeholder={queueText.passwordHint}
                />
              </div>

              <div className="field full">
                <label>{copy.home.channels}</label>
                <div className="channel-picker">
                  {channelAvailability.map(({ channel, conflict }) => {
                    const selected = selectedChannelSet.has(channel);
                    const channelStyle = {
                      '--channel-color': getChannelColor(channel),
                    } as CSSProperties;

                    return (
                      <button
                        key={channel}
                        type="button"
                        className={`channel-toggle ${selected ? 'selected' : ''}`}
                        style={channelStyle}
                        disabled={!!conflict}
                        aria-pressed={selected}
                        onClick={() => toggleChannel(channel)}
                        title={
                          conflict
                            ? copy.home.conflictTitle(conflict.applicant)
                            : selected
                              ? copy.home.selectedTitle(channel)
                              : copy.home.addChannelTitle(channel)
                        }
                      >
                        <span>{channel}</span>
                        <small>
                          {conflict
                            ? copy.home.booked
                            : selected
                              ? copy.home.selected
                              : copy.home.available}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="inline-note">
                  {copy.home.channelHelp}
                </div>
              </div>

              <div className="field">
                <label htmlFor="modal-start">{copy.home.equipmentStart}</label>
                <input
                  id="modal-start"
                  type="datetime-local"
                  value={selectedSlot.startAt}
                  readOnly
                />
              </div>

              <div className="field">
                <label htmlFor="modal-end-date">{copy.home.equipmentEnd}</label>
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
                <label htmlFor="modal-purpose">{copy.home.memo}</label>
                <textarea
                  id="modal-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder={copy.home.memoPlaceholder}
                />
              </div>

              <div className="inline-note full-line">
                {copy.home.endTimeHelp(settings.maxDurationDays)}
              </div>

              <div className="action-row">
                <button className="button" type="submit" disabled={!canSaveBooking || submitting || !queue.canBook}>
                  {copy.home.saveBooking}
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  disabled={submitting || queue.busy}
                  onClick={dismissBookingForm}
                >
                  {copy.home.cancel}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {cancellingBooking ? (
        <div className="modal-overlay" onClick={() => setCancellingBooking(null)}>
          <section
            className="modal-card cancel-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <div>
                <div className="eyebrow">Cancel Booking</div>
                <h2 className="section-title">Cancel this reserved slot</h2>
              </div>
              <button
                type="button"
                className="button-ghost"
                onClick={() => setCancellingBooking(null)}
              >
                Close
              </button>
            </div>

            <div
              className="reservation-card channel-card section"
              style={
                {
                  '--channel-color': getChannelColor(cancellingBooking.channel),
                } as CSSProperties
              }
            >
              <div className="card-head">
                <div>
                  <strong>
                    {cancellingBooking.applicant} · {cancellingBooking.channel}
                  </strong>
                  <div className="muted">
                    {formatDateTimeLabelForLanguage(
                      cancellingBooking.startAt,
                      language,
                    )}{' '}
                    -{' '}
                    {formatDateTimeLabelForLanguage(
                      cancellingBooking.endAt,
                      language,
                    )}
                  </div>
                </div>
                <span className="channel-badge">
                  {cancellingBooking.channel}
                </span>
              </div>
              <div className="muted">
                {cancellingBooking.purpose || 'No memo was entered.'}
              </div>
            </div>

            {cancellingBookings.length > 1 ? (
              <div className="inline-note section">
                {cancellingBookings.length} selected booking blocks will be
                cancelled with the same password.
              </div>
            ) : null}

            <form
              className="form-grid section"
              onSubmit={async (event) => {
                event.preventDefault();
                const results = [];

                for (const booking of cancellingBookings) {
                  results.push(
                    await cancelBooking({
                      id: booking.id,
                      requestedBy: booking.applicant,
                      password: cancelPassword,
                    }),
                  );
                }

                const failed = results.filter((item) => !item.ok);
                const result =
                  failed.length > 0
                    ? {
                        ok: false,
                        message: failed.map((item) => item.message).join(' '),
                      }
                    : {
                        ok: true,
                        message:
                          cancellingBookings.length === 1
                            ? results[0].message
                            : `${cancellingBookings.length} bookings were cancelled.`,
                      };

                setCancelMessage({ ok: result.ok, text: result.message });

                if (result.ok) {
                  setMessage({ ok: true, text: result.message });
                  setCancellingBooking(null);
                  setCancelPassword('');
                }
              }}
            >
              <div className="field full">
                <label htmlFor="cancel-password">
                  Cancellation Password (if set)
                </label>
                <input
                  id="cancel-password"
                  type="password"
                  value={cancelPassword}
                  onChange={(event) => setCancelPassword(event.target.value)}
                  placeholder="Leave blank if this booking was created without a password."
                />
              </div>

              <div className="action-row">
                <button className="button-danger" type="submit">
                  Cancel Booking
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setCancellingBooking(null)}
                >
                  Keep Booking
                </button>
              </div>
            </form>

            {cancelMessage ? (
              <div
                className={`inline-message section ${
                  cancelMessage.ok ? 'success' : 'error'
                }`}
              >
                {cancelMessage.text}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
