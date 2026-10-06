'use client';

import { useEffect, useRef, useState } from 'react';
import type { QueueOperation, QueueStatus } from '../lib/booking-queue';

export function useBookingQueue({ resetOnMount = false } = {}) {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [ready, setReady] = useState(!resetOnMount);
  const initialized = useRef(!resetOnMount);
  const inFlight = useRef<Promise<QueueStatus | null> | null>(null);
  const deadline = useRef(0);
  const alive = useRef(true);
  const latest = useRef<QueueStatus | null>(null);

  async function request(operation: QueueOperation) {
    if (operation === 'status' && inFlight.current) return null;
    if (operation !== 'status') setBusy(true);
    // User actions must wait for a poll, not disappear behind it.
    while (inFlight.current) await inFlight.current;
    if (!alive.current) return null;
    if (operation !== 'status') setBusy(true);
    const task = (async () => {
      try {
        const started = performance.now();
        const response = await fetch('/api/reservations/queue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation }), cache: 'no-store', signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error('Queue unavailable');
        const next = await response.json() as QueueStatus;
        if (alive.current) {
          // Use the server clock; subtract the round trip conservatively.
          deadline.current = started + Math.max(0, next.expiresAt ? Date.parse(next.expiresAt) - Date.parse(next.serverNow) : 0);
          latest.current = next;
          setStatus(next);
          setRemaining(Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000)));
          setError(false);
        }
        return next;
      } catch {
        if (alive.current) setError(true);
        return null;
      } finally {
        inFlight.current = null;
        if (alive.current) setBusy(false);
      }
    })();
    inFlight.current = task;
    return task;
  }

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const next = await request(initialized.current ? 'status' : 'leave');
      if (cancelled) return;
      if (next && !initialized.current) {
        initialized.current = true;
        setReady(true);
      }
      const state = latest.current?.state;
      timer = setTimeout(poll, state === 'waiting' || state === 'active' ? 2000 : 15000);
    };
    void poll();
    const sync = () => { if (initialized.current && document.visibilityState === 'visible') void request('status'); };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    const countdown = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000))), 250);
    return () => {
      alive.current = false;
      cancelled = true;
      clearTimeout(timer);
      clearInterval(countdown);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [status?.state, resetOnMount]);

  return {
    status, error, busy, remaining, ready,
    canBook: ready && !!status && !error && status.state === 'active' && remaining > 0,
    join: () => request('join'), leave: () => request('leave'), refresh: () => request('status'),
  };
}

export type BookingQueue = ReturnType<typeof useBookingQueue>;
