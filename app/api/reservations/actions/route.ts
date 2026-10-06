import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isBookingQueueEnabled } from '../../../../lib/booking-queue';
import { BOOKING_TURN_COOKIE, readBookingTurn } from '../../../../lib/booking-turn';
import { isAdminSession } from '../../../../lib/admin-auth';
import { hashQueueCookie, isSameOriginRequest, readQueueCookie } from '../../../../lib/queue-session';
import {
  applyReservationAction,
  type ReservationAction,
} from '../../../../lib/reservation-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, message: 'Invalid origin.' }, { status: 403 });
  try {
    const action = (await request.json()) as ReservationAction;
    const timedWrite = !isBookingQueueEnabled() && (action.type === 'addBookings' || action.type === 'updateBooking');
    if (timedWrite && readBookingTurn((await cookies()).get(BOOKING_TURN_COOKIE)?.value)?.state !== 'active') {
      return NextResponse.json({ ok: false, message: 'Your 2-minute booking session has ended. Press Book Now to start again.' }, { status: 403 });
    }
    const session = await readQueueCookie();
    const result = await applyReservationAction(action, {
      isAdmin: await isAdminSession(),
      queueSession: session ? hashQueueCookie(session) : undefined,
    });

    const response = NextResponse.json(result, { status: result.ok ? 200 : 400 });
    if (timedWrite && result.ok) response.cookies.delete(BOOKING_TURN_COOKIE);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process reservation action.',
      },
      { status: 500 },
    );
  }
}
