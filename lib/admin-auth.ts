import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const ADMIN_COOKIE = 'potentiostat_admin_session';
const FALLBACK_PASSWORD = '001127';

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? FALLBACK_PASSWORD;
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? getAdminPassword();
}

function createSessionValue() {
  return createHmac('sha256', getSessionSecret())
    .update('potentiostat-admin')
    .digest('hex');
}

export function verifyAdminPassword(password: string) {
  return password === getAdminPassword();
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === createSessionValue();
}

export function setAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
