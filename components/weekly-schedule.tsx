'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  formatShortDateLabelForLanguage,
} from '../lib/i18n';
import { useReservation } from './reservation-context';
import { useLanguage } from './language-context';
import {
  CHANNELS,
  addHours,
  type Booking,
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
  channels?: Channel[];
  startAt: string;
  endAt: string;
};

type WeeklyScheduleProps = {
  anchorDate: Date;
  now: Date;
  selectedSlot: SelectedSlot | null;
  onSelectSlot: (slot: SelectedSlot) => void;
  onCancelBooking?: (booking: Booking) => void;
  onCancelBookings?: (bookings: Booking[]) => void;
  onShiftWeek: (direction: number) => void;
};

type DragSelection = {
  mode: 'reserve' | 'cancel';
  dateKey: string;
  startChannel: Channel;
  endChannel: Channel;
  startHour: number;
  endHour: number;
  bookingGroupKey?: string;
};

export function WeeklySchedule({
  anchorDate,
  now,
  selectedSlot,
  onSelectSlot,
  onCancelBooking,
  onCancelBookings,
  onShiftWeek,
}: WeeklyScheduleProps) {
  const { bookings, blockedDates, settings } = useReservation();
  const { copy, language } = useLanguage();
  const hourRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const previousHourRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(
    null,
  );
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

  function getActiveBooking(date: Date, channel: Channel, hour: number) {
    const slotStart = setHour(date, hour);
    const slotEnd = addHours(slotStart, 1);
    return findActiveBookingConflict(
      bookings,
      channel,
      slotStart,
      slotEnd,
    );
  }

  function getBookingGroupKey(booking: Booking) {
    return [
      booking.applicant,
      booking.startAt,
      booking.endAt,
      booking.purpose,
      booking.createdAt,
    ].join('|');
  }

  function getBookingsInDragRange(selection: DragSelection, date: Date) {
    const firstHour = Math.min(selection.startHour, selection.endHour);
    const lastHour = Math.max(selection.startHour, selection.endHour);
    const firstChannelIndex = Math.min(
      CHANNELS.indexOf(selection.startChannel),
      CHANNELS.indexOf(selection.endChannel),
    );
    const lastChannelIndex = Math.max(
      CHANNELS.indexOf(selection.startChannel),
      CHANNELS.indexOf(selection.endChannel),
    );
    const uniqueBookings = new Map<string, Booking>();

    for (
      let channelIndex = firstChannelIndex;
      channelIndex <= lastChannelIndex;
      channelIndex += 1
    ) {
      const channel = CHANNELS[channelIndex];

      for (let hour = firstHour; hour <= lastHour; hour += 1) {
        const booking = getActiveBooking(date, channel, hour);

        if (booking) {
          uniqueBookings.set(booking.id, booking);
        }
      }
    }

    return [...uniqueBookings.values()];
  }

  function isSlotSelectable(date: Date, channel: Channel, hour: number) {
    const slotStart = setHour(date, hour);
    const slotDateKey = toDateKey(slotStart);
    const activeBooking = getActiveBooking(date, channel, hour);

    return (
      !activeBooking &&
      !blockedDates.includes(slotDateKey) &&
      isStartWithinBookingWindow(slotStart, settings, now)
    );
  }

  function isDragRangeSelectable(
    date: Date,
    startChannel: Channel,
    endChannel: Channel,
    startHour: number,
    endHour: number,
  ) {
    const firstChannelIndex = Math.min(
      CHANNELS.indexOf(startChannel),
      CHANNELS.indexOf(endChannel),
    );
    const lastChannelIndex = Math.max(
      CHANNELS.indexOf(startChannel),
      CHANNELS.indexOf(endChannel),
    );
    const firstHour = Math.min(startHour, endHour);
    const lastHour = Math.max(startHour, endHour);

    for (
      let channelIndex = firstChannelIndex;
      channelIndex <= lastChannelIndex;
      channelIndex += 1
    ) {
      const channel = CHANNELS[channelIndex];

      for (let hour = firstHour; hour <= lastHour; hour += 1) {
        if (!isSlotSelectable(date, channel, hour)) {
          return false;
        }
      }
    }

    return true;
  }

  function isCancelDragRangeSelectable(
    date: Date,
    startChannel: Channel,
    endChannel: Channel,
    startHour: number,
    endHour: number,
    bookingGroupKey: string,
  ) {
    const firstChannelIndex = Math.min(
      CHANNELS.indexOf(startChannel),
      CHANNELS.indexOf(endChannel),
    );
    const lastChannelIndex = Math.max(
      CHANNELS.indexOf(startChannel),
      CHANNELS.indexOf(endChannel),
    );
    const firstHour = Math.min(startHour, endHour);
    const lastHour = Math.max(startHour, endHour);

    for (
      let channelIndex = firstChannelIndex;
      channelIndex <= lastChannelIndex;
      channelIndex += 1
    ) {
      const channel = CHANNELS[channelIndex];

      for (let hour = firstHour; hour <= lastHour; hour += 1) {
        const booking = getActiveBooking(date, channel, hour);

        if (!booking || getBookingGroupKey(booking) !== bookingGroupKey) {
          return false;
        }
      }
    }

    return true;
  }

  function commitDragSelection(selection: DragSelection | null) {
    if (!selection) {
      return;
    }

    const selectedDate = weekDates.find(
      (date) => toDateKey(date) === selection.dateKey,
    );

    if (!selectedDate) {
      setDragSelection(null);
      return;
    }

    if (selection.mode === 'cancel') {
      const selectedBookings = getBookingsInDragRange(selection, selectedDate);

      if (selectedBookings.length > 0) {
        onCancelBookings?.(selectedBookings);
      }

      suppressClickRef.current = true;
      setDragSelection(null);

      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      return;
    }

    const firstHour = Math.min(selection.startHour, selection.endHour);
    const lastHour = Math.max(selection.startHour, selection.endHour);
    const firstChannelIndex = Math.min(
      CHANNELS.indexOf(selection.startChannel),
      CHANNELS.indexOf(selection.endChannel),
    );
    const lastChannelIndex = Math.max(
      CHANNELS.indexOf(selection.startChannel),
      CHANNELS.indexOf(selection.endChannel),
    );
    const selectedChannels = CHANNELS.slice(
      firstChannelIndex,
      lastChannelIndex + 1,
    );

    onSelectSlot({
      channel: selectedChannels[0],
      channels: selectedChannels,
      startAt: toDateTimeLocal(setHour(selectedDate, firstHour)),
      endAt: toDateTimeLocal(setHour(selectedDate, lastHour + 1)),
    });
    suppressClickRef.current = true;
    setDragSelection(null);

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

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

                    const activeBooking = getActiveBooking(date, channel, group.hour);

                    const visibleBooking = activeBooking ?? null;
                    const inBlockedDate = blockedDates.includes(slotDateKey);
                    const inWindow = isStartWithinBookingWindow(
                      slotStart,
                      settings,
                      now,
                    );
                    const selectable = !activeBooking && !inBlockedDate && inWindow;
                    const inDragSelection =
                      !!dragSelection &&
                      dragSelection.dateKey === slotDateKey &&
                      channelIndex >=
                        Math.min(
                          CHANNELS.indexOf(dragSelection.startChannel),
                          CHANNELS.indexOf(dragSelection.endChannel),
                        ) &&
                      channelIndex <=
                        Math.max(
                          CHANNELS.indexOf(dragSelection.startChannel),
                          CHANNELS.indexOf(dragSelection.endChannel),
                        ) &&
                      group.hour >=
                        Math.min(
                          dragSelection.startHour,
                          dragSelection.endHour,
                        ) &&
                      group.hour <=
                        Math.max(
                          dragSelection.startHour,
                          dragSelection.endHour,
                        );
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

                    if (inDragSelection) {
                      className +=
                        dragSelection.mode === 'cancel'
                          ? ' cancel-drag-selected'
                          : ' drag-selected';
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
                          onPointerDown={(event) => {
                            if (event.button !== 0) {
                              return;
                            }

                            if (visibleBooking) {
                              event.preventDefault();
                              setDragSelection({
                                mode: 'cancel',
                                dateKey: slotDateKey,
                                startChannel: channel,
                                endChannel: channel,
                                startHour: group.hour,
                                endHour: group.hour,
                                bookingGroupKey:
                                  getBookingGroupKey(visibleBooking),
                              });
                              return;
                            }

                            if (!selectable) {
                              return;
                            }

                            event.preventDefault();
                            setDragSelection({
                              mode: 'reserve',
                              dateKey: slotDateKey,
                              startChannel: channel,
                              endChannel: channel,
                              startHour: group.hour,
                              endHour: group.hour,
                            });
                          }}
                          onPointerEnter={(event) => {
                            if (
                              !dragSelection ||
                              event.buttons !== 1 ||
                              dragSelection.dateKey !== slotDateKey
                            ) {
                              return;
                            }

                            const canExtend =
                              dragSelection.mode === 'cancel'
                                ? !!dragSelection.bookingGroupKey &&
                                  isCancelDragRangeSelectable(
                                    date,
                                    dragSelection.startChannel,
                                    channel,
                                    dragSelection.startHour,
                                    group.hour,
                                    dragSelection.bookingGroupKey,
                                  )
                                : isDragRangeSelectable(
                                    date,
                                    dragSelection.startChannel,
                                    channel,
                                    dragSelection.startHour,
                                    group.hour,
                                  );

                            if (canExtend) {
                              setDragSelection({
                                ...dragSelection,
                                endChannel: channel,
                                endHour: group.hour,
                              });
                            }
                          }}
                          onPointerUp={(event) => {
                            if (!dragSelection) {
                              return;
                            }

                            event.preventDefault();
                            commitDragSelection(dragSelection);
                          }}
                          onClick={() => {
                            if (suppressClickRef.current) {
                              return;
                            }

                            if (visibleBooking) {
                              onCancelBooking?.(visibleBooking);
                              return;
                            }

                            if (selectable) {
                              onSelectSlot({
                                channel,
                                startAt: toDateTimeLocal(slotStart),
                                endAt: toDateTimeLocal(slotEnd),
                              });
                            }
                          }}
                          disabled={!selectable && !visibleBooking}
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
