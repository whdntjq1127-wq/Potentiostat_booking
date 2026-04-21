'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useReservation } from './reservation-context';
import {
  CHANNELS,
  addHours,
  formatShortDateLabel,
  getChannelColor,
  getChannelSoftColor,
  getWeekDates,
  isStartWithinBookingWindow,
  overlaps,
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
  const scheduleWrapRef = useRef<HTMLDivElement | null>(null);
  const hourRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const previousHourRef = useRef<number | null>(null);
  const weekDates = getWeekDates(anchorDate);
  const currentHour = now.getHours();
  const hourGroups = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}:00~${String((hour + 1) % 24).padStart(2, '0')}:00`,
      })),
    [],
  );

  useEffect(() => {
    const container = scheduleWrapRef.current;
    const targetRow = hourRowRefs.current[currentHour];

    if (!container || !targetRow) {
      previousHourRef.current = currentHour;
      return;
    }

    const headerHeight = container.querySelector('thead')?.clientHeight ?? 0;
    const nextTop = Math.max(targetRow.offsetTop - headerHeight, 0);
    const behavior =
      previousHourRef.current === null || previousHourRef.current === currentHour
        ? 'auto'
        : 'smooth';

    container.scrollTo({ top: nextTop, behavior });
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
          Previous Week
        </button>
        <strong>
          {formatShortDateLabel(weekDates[0])} -{' '}
          {formatShortDateLabel(weekDates[weekDates.length - 1])}
        </strong>
        <button
          type="button"
          className="button-ghost"
          onClick={() => onShiftWeek(1)}
        >
          Next Week
        </button>
      </div>

      <div ref={scheduleWrapRef} className="schedule-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="corner-cell time-head" rowSpan={2}>
                Time
              </th>
              {weekDates.map((date) => (
                <th
                  key={toDateKey(date)}
                  className="date-head"
                  colSpan={CHANNELS.length}
                >
                  {formatShortDateLabel(date)}
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

                    const activeBooking = bookings.find((booking) => {
                      if (booking.status !== 'active') {
                        return false;
                      }

                      if (booking.channel !== channel) {
                        return false;
                      }

                      return overlaps(
                        slotStart,
                        slotEnd,
                        new Date(booking.startAt),
                        new Date(booking.endAt),
                      );
                    });

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
                              ? `${visibleBooking.applicant}'s booking`
                              : inBlockedDate
                                ? 'This date is blocked by the admin'
                                : inWindow
                                  ? 'This slot cannot be selected'
                                  : 'The start date is outside the booking window'
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
