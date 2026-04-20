'use client';

import type { CSSProperties } from 'react';
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
  const weekDates = getWeekDates(anchorDate);
  const hourGroups = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00~${String((hour + 1) % 24).padStart(2, '0')}:00`,
  }));

  return (
    <div className="schedule-shell">
      <div className="week-toolbar">
        <button
          type="button"
          className="button-ghost"
          onClick={() => onShiftWeek(-1)}
        >
          이전 주
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
          다음 주
        </button>
      </div>

      <div className="schedule-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="corner-cell time-head">시간</th>
              <th className="corner-cell channel-head">채널</th>
              {weekDates.map((date) => (
                <th key={toDateKey(date)}>{formatShortDateLabel(date)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hourGroups.map((group) =>
              CHANNELS.map((channel, index) => (
                <tr key={`${group.hour}-${channel}`}>
                  {(() => {
                    const channelStyle = {
                      '--channel-color': getChannelColor(channel),
                      '--channel-color-soft': getChannelSoftColor(channel),
                    } as CSSProperties;

                    return (
                      <>
                  {index === 0 ? (
                    <th className="time-group-cell" rowSpan={CHANNELS.length}>
                      {group.label}
                    </th>
                  ) : null}

                  <th
                    className="slot-label-cell"
                    style={channelStyle}
                  >
                    <span>{channel}</span>
                  </th>

                  {weekDates.map((date) => {
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
                        key={`${group.hour}-${channel}-${slotDateKey}`}
                        className="slot-cell"
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
                              ? `${visibleBooking.applicant}님 예약`
                              : inBlockedDate
                                  ? '관리자에 의해 차단된 날짜입니다'
                                  : inWindow
                                    ? '선택할 수 없는 슬롯입니다'
                                    : '예약 가능 범위를 벗어난 시작 날짜입니다'
                          }
                        >
                          {visibleBooking ? visibleBooking.applicant : selectable ? '' : '/'}
                        </button>
                      </td>
                    );
                  })}
                      </>
                    );
                  })()}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
