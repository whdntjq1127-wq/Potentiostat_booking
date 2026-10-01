import { NextResponse } from 'next/server';
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
    const session = await readQueueCookie();
    const result = await applyReservationAction(action, {
      isAdmin: await isAdminSession(),
      queueSession: session ? hashQueueCookie(session) : undefined,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
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
