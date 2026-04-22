import { NextResponse } from 'next/server';
import {
  setAdminSessionCookie,
  verifyAdminPassword,
} from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!verifyAdminPassword(body.password ?? '')) {
    return NextResponse.json(
      { ok: false, message: 'The password is incorrect.' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  setAdminSessionCookie(response);
  return response;
}
