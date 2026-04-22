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
  const { copy, language } = useLanguage();
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
        dateLabel: formatShortDateLabelForLanguage(candidate, language),
        timeLabel: formatDisplayTime(candidate),
      });
    }

    return options;
  }, [blockedDates, bookings, language, selectedSlot, settings]);

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
          <div className="eyebrow">{copy.home.loadingEyebrow}</div>
          <h1 className="section-title">{copy.home.loadingTitle}</h1>
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
    selectedChannels.length > 0
      ? selectedChannels.join(', ')
      : copy.home.noChannelSelected;
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
              <div className="eyebrow">{copy.home.weeklyEyebrow}</div>
              <h2 className="section-title">{copy.home.weeklyTitle}</h2>
            </div>
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
                <div className="eyebrow">{copy.home.createEyebrow}</div>
                <h2 className="section-title">{copy.home.createTitle}</h2>
              </div>
              <button
                type="button"
                className="button-ghost"
                onClick={() => setSelectedSlot(null)}
              >
                {copy.home.close}
              </button>
            </div>

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
                <label htmlFor="modal-applicant">{copy.home.userName}</label>
                <input
                  id="modal-applicant"
                  type="text"
                  value={applicant}
                  onChange={(event) => setApplicant(event.target.value)}
                  placeholder={copy.home.applicantPlaceholder}
                  required
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
                <button className="button" type="submit" disabled={!canSaveBooking}>
                  {copy.home.saveBooking}
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setSelectedSlot(null)}
                >
                  {copy.home.cancel}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
