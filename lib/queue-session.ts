import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

export const QUEUE_COOKIE = 'pb_booking_queue_session';
export const newQueueCookie = () => randomBytes(32).toString('hex');
export const hashQueueCookie = (value: string) => createHash('sha256').update(value).digest('hex');

export async function readQueueCookie() {
  const value = (await cookies()).get(QUEUE_COOKIE)?.value;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function isSameOriginRequest(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get('host'); }
  catch { return false; }
}
