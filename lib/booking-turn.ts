import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const BOOKING_TURN_COOKIE = 'pb_booking_turn';
const TURN_MS = 120_000;

declare global {
  var __potentiostatBookingTurnSecret: string | undefined;
}

function signingKey() {
  const configured = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  // Local/file mode can fail closed on restart; production Supabase uses its server-only key.
  return globalThis.__potentiostatBookingTurnSecret ??= randomBytes(32).toString('hex');
}

function sign(payload: string) {
  return createHmac('sha256', signingKey()).update(`potentiostat:booking-turn:v1:${payload}`).digest('hex');
}

export function createBookingTurn(now = Date.now()) {
  const payload = `${now}.${randomBytes(32).toString('hex')}`;
  return `${payload}.${sign(payload)}`;
}

export function readBookingTurn(value: string | undefined, now = Date.now()) {
  if (!value || !/^\d{1,16}\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return null;
  const [issued, nonce, signature] = value.split('.');
  const issuedAt = Number(issued);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now) return null;
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(`${issued}.${nonce}`), 'hex'))) return null;
  const expiresAt = issuedAt + TURN_MS;
  return { expiresAt, state: now < expiresAt ? 'active' as const : 'expired' as const };
}
