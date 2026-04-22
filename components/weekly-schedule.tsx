'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  formatShortDateLabelForLanguage,
} from '../lib/i18n';
import { useReservation } from './reservation-context';
import { useLanguage } from './language-context';
import {
  CHANNELS,
  addHours,
  findActiveBookingConflict,
  getChannelColor,
  getChannelSoftColor,
  getWeekDates,
  isStartWithinBookingWindow,
  setHour,
  toDateKey,
  toDateTimeLocal,
  type Channel,
} from '../lib/reservation-data';

export type SelectedSlot = {
  channel: Channel;
  startAt: string;
  endAt: string;
};

type WeeklyScheduleProps = {
  anchorDate: Date;
  now: Date;
  selectedSlot: SelectedSlot | null;
  onSelectSlot: (slot: SelectedSlot) => void;
  onShiftWeek: (direction: number) => void;
};

export function WeeklySchedule({
  anchorDate,
  now,
  selectedSlot,
  onSelectSlot,
  onShiftWeek,
}: WeeklyScheduleProps) {
  const { bookings, blockedDates, settings } = useReservation();
  const { copy, language } = useLanguage();
  const hourRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const previousHourRef = useRef<number | null>(null);
  const weekDates = getWeekDates(anchorDate);
  const currentHour = now.getHours();
  const hourGroups = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
      })),
    [],
  );

  useEffect(() => {
    const targetRow = hourRowRefs.current[currentHour];

    if (!targetRow) {
      previousHourRef.current = currentHour;
      return;
    }

    const nextTop = Math.max(
      targetRow.getBoundingClientRect().top + window.scrollY - 76,
      0,
    );
    const behavior =
      previousHourRef.current === null || previousHourRef.current === currentHour
        ? 'auto'
        : 'smooth';

    window.scrollTo({ top: nextTop, behavior });
    previousHourRef.current = currentHour;
  }, [anchorDate, currentHour]);

  return (
    <div className="schedule-shell">
      <div className="week-toolbar">
        <button
          type="button"
          className="button-ghost"
          onClick={() => onShiftWeek(-1)}
        >
          {copy.schedule.previousWeek}
        </button>
        <strong>
          {formatShortDateLabelForLanguage(weekDates[0], language)} -{' '}
          {formatShortDateLabelForLanguage(
            weekDates[weekDates.length - 1],
            language,
          )}
        </strong>
        <button
          type="button"
          className="button-ghost"
          onClick={() => onShiftWeek(1)}
        >
          {copy.schedule.nextWeek}
        </button>
      </div>

      <div className="schedule-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="corner-cell time-head" rowSpan={2}>
                {copy.schedule.startingTime}
              </th>
              {weekDates.map((date) => (
                <th
                  key={toDateKey(date)}
                  className="date-head"
                  colSpan={CHANNELS.length}
                >
                  {formatShortDateLabelForLanguage(date, language)}
                </th>
              ))}
            </tr>
            <tr>
              {weekDates.map((date) =>
                CHANNELS.map((channel, channelIndex) => {
                  const dateKey = toDateKey(date);
                  const channelStyle = {
                    '--channel-color': getChannelColor(channel),
                    '--channel-color-soft': getChannelSoftColor(channel),
                  } as CSSProperties;

                  return (
                    <th
                      key={`${dateKey}-${channel}`}
                      className={`channel-subhead ${
                        channelIndex === CHANNELS.length - 1
                          ? 'date-end-cell'
                          : ''
                      }`}
                      style={channelStyle}
                    >
                      {channel}
                    </th>
                  );
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {hourGroups.map((group) => (
              <tr
                key={group.hour}
                ref={(node) => {
                  hourRowRefs.current[group.hour] = node;
                }}
              >
                <th className="time-group-cell">{group.label}</th>

                {weekDates.map((date) =>
                  CHANNELS.map((channel, channelIndex) => {
                    const channelStyle = {
                      '--channel-color': getChannelColor(channel),
                      '--channel-color-soft': getChannelSoftColor(channel),
                    } as CSSProperties;
                    const slotStart = setHour(date, group.hour);
                    const slotEnd = addHours(slotStart, 1);
                    const slotDateKey = toDateKey(slotStart);

                    const activeBooking = findActiveBookingConflict(
                      bookings,
                      channel,
                      slotStart,
                      slotEnd,
                    );

                    const visibleBooking = activeBooking ?? null;
                    const inBlockedDate = blockedDates.includes(slotDateKey);
                    const inWindow = isStartWithinBookingWindow(
                      slotStart,
                      settings,
                      now,
                    );
                    const selectable = !activeBooking && !inBlockedDate && inWindow;
                    const isSelected =
                      !!selectedSlot &&
                      selectedSlot.channel === channel &&
                      selectedSlot.startAt === toDateTimeLocal(slotStart);

                    let className = 'slot-button';
                    if (visibleBooking) {
                      className += ' booked';
                    } else if (!selectable) {
                      className += ' unavailable';
                    } else {
                      className += ' available';
                    }

                    if (isSelected) {
                      className += ' selected';
                    }

                    return (
                      <td
                        key={`${group.hour}-${slotDateKey}-${channel}`}
                        className={`slot-cell ${
                          channelIndex === CHANNELS.length - 1
                            ? 'date-end-cell'
                            : ''
                        }`}
                        style={channelStyle}
                      >
                        <button
                          type="button"
                          className={className}
                          style={channelStyle}
                          onClick={() =>
                            selectable
                              ? onSelectSlot({
                                  channel,
                                  startAt: toDateTimeLocal(slotStart),
                                  endAt: toDateTimeLocal(slotEnd),
                                })
                              : undefined
                          }
                          disabled={!selectable}
                          title={
                            visibleBooking
                              ? copy.schedule.bookedByTitle(
                                  visibleBooking.applicant,
                                )
                              : inBlockedDate
                                ? copy.schedule.blockedDateTitle
                                : inWindow
                                  ? copy.schedule.notSelectableTitle
                                  : copy.schedule.outsideWindowTitle
                          }
                        >
                          {visibleBooking
                            ? visibleBooking.applicant
                            : selectable
                              ? ''
                              : '/'}
                        </button>
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
