'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  initialBlockedDates,
  initialBookings,
  initialNotices,
  type Booking,
  type BookingStatus,
} from '../lib/reservation-data';

type ReservationContextValue = {
  bookings: Booking[];
  blockedDates: string[];
  notices: string[];
  addBooking: (input: {
    date: string;
    startTime: string;
    endTime: string;
    purpose: string;
  }) => void;
  cancelBooking: (id: string) => void;
  updateStatus: (id: string, status: BookingStatus) => void;
  blockDate: (date: string) => void;
  addNotice: (notice: string) => void;
};

const ReservationContext = createContext<ReservationContextValue | null>(null);

function formatDateLabel(date: string) {
  return `${date} 예약`;
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [blockedDates, setBlockedDates] = useState<string[]>(initialBlockedDates);
  const [notices, setNotices] = useState<string[]>(initialNotices);

  const value = useMemo<ReservationContextValue>(
    () => ({
      bookings,
      blockedDates,
      notices,
      addBooking: ({ date, startTime, endTime, purpose }) => {
        const newBooking: Booking = {
          id: `demo-${Date.now()}`,
          applicant: '김연구',
          affiliation: '전기화학 연구실',
          date,
          startTime,
          endTime,
          purpose,
          status: 'pending',
          equipment: 'Potentiostat / Galvanostat SP-300',
        };
        setBookings((current) => [newBooking, ...current]);
      },
      cancelBooking: (id) => {
        setBookings((current) =>
          current.map((booking) =>
            booking.id === id ? { ...booking, status: 'cancelled' } : booking,
          ),
        );
      },
      updateStatus: (id, status) => {
        setBookings((current) =>
          current.map((booking) =>
            booking.id === id ? { ...booking, status } : booking,
          ),
        );
      },
      blockDate: (date) => {
        if (!date) {
          return;
        }
        setBlockedDates((current) =>
          current.includes(date) ? current : [date, ...current].sort(),
        );
        setNotices((current) => [
          `관리자 안내: ${formatDateLabel(date)}은 정기 점검으로 차단되었습니다.`,
          ...current,
        ]);
      },
      addNotice: (notice) => {
        const trimmed = notice.trim();
        if (!trimmed) {
          return;
        }
        setNotices((current) => [trimmed, ...current]);
      },
    }),
    [blockedDates, bookings, notices],
  );

  return (
    <ReservationContext.Provider value={value}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const context = useContext(ReservationContext);
  if (!context) {
    throw new Error('useReservation must be used within ReservationProvider');
  }
  return context;
}
