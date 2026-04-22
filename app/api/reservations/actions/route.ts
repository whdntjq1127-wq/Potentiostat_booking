import { NextResponse } from 'next/server';
import { isAdminSession } from '../../../../lib/admin-auth';
import {
  applyReservationAction,
  type ReservationAction,
} from '../../../../lib/reservation-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const action = (await request.json()) as ReservationAction;
    const result = await applyReservationAction(action, {
      isAdmin: await isAdminSession(),
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
