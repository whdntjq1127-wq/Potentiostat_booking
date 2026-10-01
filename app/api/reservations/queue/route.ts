import { NextResponse } from 'next/server';
import { disabledQueueStatus, isBookingQueueEnabled } from '../../../../lib/booking-queue';
import { getReservationStore } from '../../../../lib/reservation-store';
import { hashQueueCookie, isSameOriginRequest, newQueueCookie, QUEUE_COOKIE, readQueueCookie } from '../../../../lib/queue-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: 'Invalid origin.' }, { status: 403 });
  if (!isBookingQueueEnabled()) return NextResponse.json(disabledQueueStatus(), { headers: { 'Cache-Control': 'no-store' } });
  try {
    const { operation } = await request.json();
    if (!['status', 'join', 'leave'].includes(operation)) {
      return NextResponse.json({ message: 'Invalid queue operation.' }, { status: 400 });
    }
    const store = getReservationStore();
    if (!store.bookingQueue) throw new Error('Queue requires Supabase.');
    const existing = await readQueueCookie();
    const session = existing ?? newQueueCookie();
    const status = await store.bookingQueue(hashQueueCookie(session), operation);
    const response = NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
    if (!existing) response.cookies.set(QUEUE_COOKIE, session, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400,
    });
    return response;
  } catch {
    return NextResponse.json({ message: 'Booking queue unavailable. Please retry shortly.' }, { status: 503 });
  }
}
