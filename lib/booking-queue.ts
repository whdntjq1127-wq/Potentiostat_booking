export type QueueOperation = 'status' | 'join' | 'leave';
export type QueueStatus = {
  enabled: boolean;
  state: 'idle' | 'waiting' | 'active' | 'expired' | 'cancelled' | 'complete';
  // Waiting-only rank: 1 is next to enter; admitted sessions report 1.
  position: number;
  ahead: number;
  expiresAt: string | null;
  serverNow: string;
};

export function isBookingQueueEnabled() {
  return process.env.RESERVATION_QUEUE_ENABLED === 'true';
}

export function disabledQueueStatus(): QueueStatus {
  return { enabled: false, state: 'idle', position: 0, ahead: 0, expiresAt: null, serverNow: new Date().toISOString() };
}
