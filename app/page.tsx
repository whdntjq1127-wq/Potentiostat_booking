'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useReservation } from '../components/reservation-context';
import { WeeklySchedule, type SelectedSlot } from '../components/weekly-schedule';
import {
  CHANNELS,
  addDays,
  formatDateLabel,
  formatDateTimeLabel,
  formatDisplayTime,
  findActiveBookingConflict,
  getBlockedDateInRange,
  getChannelColor,
  getLatestBookableDate,
  addHours,
  formatShortDateLabel,
  getLatestAllowedEnd,
  toDateKey,
  type Channel,
} from '../lib/reservation-data';

type EndOption = {
  value: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
};

export default function Home() {
  const { ready, addBookings, bookings, blockedDates, settings } =
    useReservation();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
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
      setSelectedChannels([]);
      return;
    }

    setSelectedChannels([selectedSlot.channel]);
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
      const blockedDate = getBlockedDateInRange(blockedDates, start, candidate);

      if (blockedDate) {
        break;
      }

      const hasConflict = findActiveBookingConflict(
        bookings,
        selectedSlot.channel,
        start,
        candidate,
      );

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
  const selectedChannelSet = new Set(selectedChannels);
  const selectedChannelLabel =
    selectedChannels.length > 0 ? selectedChannels.join(', ') : 'No channel selected';
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
              <strong>{selectedChannelLabel}</strong>
              <span>Start: {formatDateTimeLabel(selectedSlot.startAt)}</span>
              <span>End: {formatDateTimeLabel(endAt || selectedSlot.endAt)}</span>
            </div>

            <form
              className="form-grid section"
              onSubmit={async (event) => {
                event.preventDefault();

                const result = await addBookings({
                  applicant,
                  channels: selectedChannels,
                  startAt: selectedSlot.startAt,
                  endAt,
                  purpose,
                });

                setMessage({ ok: result.ok, text: result.message });

                if (result.ok) {
                  setSelectedSlot(null);
                  setSelectedChannels([]);
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

              <div className="field full">
                <label>Channels</label>
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
                        onClick={() => toggleChannel(channel)}
                        title={
                          conflict
                            ? `${conflict.applicant}'s booking overlaps this time range`
                            : selected
                              ? `${channel} selected`
                              : `Add ${channel}`
                        }
                      >
                        <span>{channel}</span>
                        <small>
                          {conflict
                            ? 'Booked'
                            : selected
                              ? 'Selected'
                              : 'Available'}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="inline-note">
                  Channels already booked during the selected time range are disabled.
                  Select multiple available channels to reserve them together.
                </div>
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
                <button className="button" type="submit" disabled={!canSaveBooking}>
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
