import { NextResponse } from 'next/server';
import { readReservationSnapshot } from '../../../lib/reservation-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await readReservationSnapshot());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load reservation data.',
      },
      { status: 500 },
    );
  }
}
