'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from './language-context';
import type { BookingQueue } from './use-booking-queue';

export const queueCopy = {
  en: {
    book: 'Book Now', select: 'Select a calendar block or drag a range, then press Book Now.',
    waiting: 'Waiting for your booking turn', position: 'Your position', ahead: 'People ahead',
    help: 'The booking form opens automatically when it is your turn. Keep this page open.',
    note: 'One person at a time. You have 2 minutes to submit. A turn does not hold a channel or time slot.',
    leave: 'Leave queue', retry: 'Join again', expired: 'Your booking turn has expired',
    expiredHelp: 'Please join the queue again. Your booking has not been submitted.',
    error: 'Cannot reach the booking queue. Reconnecting; do not submit again until the status is confirmed.',
    remaining: 'Time left to submit', ready: 'Your turn', checking: 'Checking queue...',
    ended: 'This booking session has ended',
    endedHelp: 'Check My Bookings to confirm whether a previous submission was saved before joining again.',
    resume: 'Resume booking', password: 'Cancellation Password (optional)',
    passwordHint: 'Leave blank to allow cancellation without a password.',
  },
  ko: {
    book: '예약하기', select: '달력에서 블록을 선택하거나 드래그한 후 예약하기를 눌러주세요.',
    waiting: '예약 순서를 기다리고 있습니다', position: '내 대기 순번', ahead: '앞에 대기 중',
    help: '내 차례가 되면 예약 입력 창이 자동으로 열립니다. 이 페이지를 열어두세요.',
    note: '한 번에 한 명씩, 2분 동안 예약할 수 있습니다. 입장만으로 채널이나 시간이 확보되지는 않습니다.',
    leave: '대기 취소', retry: '다시 줄 서기', expired: '예약 입력 시간이 만료되었습니다',
    expiredHelp: '다시 대기열에 참여해주세요. 예약은 등록되지 않았습니다.',
    error: '대기열 연결을 확인 중입니다. 상태가 확인될 때까지 예약을 다시 제출하지 마세요.',
    remaining: '예약 입력 남은 시간', ready: '예약할 차례입니다', checking: '대기열 확인 중...',
    ended: '예약 입력 세션이 종료되었습니다',
    endedHelp: '다시 참여하기 전에 내 예약 보기에서 이전 예약의 등록 여부를 확인해주세요.',
    resume: '예약 이어하기', password: '취소 비밀번호 (선택)',
    passwordHint: '비워두면 비밀번호 없이 취소할 수 있습니다.',
  },
};

export function QueueTimer({ queue }: { queue: BookingQueue }) {
  const { language } = useLanguage();
  if (!queue.status?.enabled) return null;
  const text = queueCopy[language];
  const seconds = queue.remaining;
  return <div className={`queue-timer ${seconds <= 20 ? 'urgent' : ''}`}>
    <span>{text.remaining}</span>
    <strong role="timer">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong>
  </div>;
}

export function BookingQueuePanel({ queue, onClose }: { queue: BookingQueue; onClose: () => void }) {
  const { language } = useLanguage();
  const text = queueCopy[language];
  const button = useRef<HTMLButtonElement>(null);
  const expired = queue.status?.state === 'expired' || (queue.status?.state === 'active' && queue.remaining <= 0);
  const ended = queue.status?.enabled && ['idle', 'complete', 'cancelled'].includes(queue.status.state) && !queue.busy;
  const visible = queue.error || queue.status?.state === 'waiting' || expired || ended;
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus();
    return () => previous?.focus();
  }, [visible]);
  if (!visible) return null;
  return <div className="modal-overlay queue-overlay">
    <section className="modal-card queue-card" role="dialog" aria-modal="true" aria-labelledby="queue-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const first = buttons[0]; const last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="eyebrow">POTENTIOSTAT / BOOKING</div>
      <h2 id="queue-title">{expired ? text.expired : ended ? text.ended : text.waiting}</h2>
      {queue.error ? <p role="alert" className="inline-message error">{text.error}</p> : expired ? <p>{text.expiredHelp}</p> : ended ? <p>{text.endedHelp}</p> : <>
        <div className="queue-counts" aria-live="polite">
          <div><span>{text.position}</span><strong>{String(queue.status?.position ?? 0).padStart(2, '0')}</strong></div>
          <div><span>{text.ahead}</span><strong>{queue.status?.ahead ?? 0}</strong></div>
        </div>
        <div className="queue-pulse" aria-hidden="true"><span /><span /><span /></div>
        <p>{text.help}</p>
      </>}
      <p className="muted">{text.note}</p>
      <div className="action-row">
        {(expired || ended) && !queue.error ? <button className="button" disabled={queue.busy} onClick={() => void queue.join()}>{text.retry}</button> : null}
        <button ref={button} className="button-ghost" disabled={queue.busy} onClick={onClose}>{text.leave}</button>
      </div>
    </section>
  </div>;
}
