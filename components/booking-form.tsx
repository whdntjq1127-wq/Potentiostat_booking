'use client';

import { useEffect, useState } from 'react';
import { useReservation } from './reservation-context';
import {
  CHANNELS,
  addHours,
  ceilToHour,
  getLatestBookableDate,
  toDateTimeLocal,
  type Channel,
} from '../lib/reservation-data';
import type { SelectedSlot } from './weekly-schedule';

type BookingFormProps = {
  title: string;
  description: string;
  prefill?: SelectedSlot | null;
};

type BookingDraft = {
  applicant: string;
  channel: Channel;
  startAt: string;
  endAt: string;
  purpose: string;
};

function createDefaultDraft(): BookingDraft {
  const start = ceilToHour(new Date());

  return {
    applicant: '',
    channel: CHANNELS[0],
    startAt: toDateTimeLocal(start),
    endAt: toDateTimeLocal(addHours(start, 1)),
    purpose: '',
  };
}

export function BookingForm({
  title,
  description,
  prefill,
}: BookingFormProps) {
  const { addBooking, settings } = useReservation();
  const [draft, setDraft] = useState<BookingDraft>(() => createDefaultDraft());
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!prefill) {
      return;
    }

    setDraft((current) => ({
      ...current,
      channel: prefill.channel,
      startAt: prefill.startAt,
      endAt: prefill.endAt,
    }));
  }, [prefill]);

  return (
    <section className="panel">
      <div className="eyebrow">예약 입력</div>
      <h2 className="section-title">{title}</h2>
      <p className="muted">{description}</p>

      <form
        className="form-grid section"
        onSubmit={(event) => {
          event.preventDefault();

          const result = addBooking(draft);
          setMessage({ ok: result.ok, text: result.message });

          if (result.ok) {
            setDraft((current) => {
              const nextStart = new Date(current.endAt);
              const nextEnd = addHours(nextStart, 1);

              return {
                ...current,
                startAt: toDateTimeLocal(nextStart),
                endAt: toDateTimeLocal(nextEnd),
                purpose: '',
              };
            });
          }
        }}
      >
        <div className="field full">
          <label htmlFor="applicant">사용자 이름</label>
          <input
            id="applicant"
            type="text"
            value={draft.applicant}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                applicant: event.target.value,
              }))
            }
            placeholder="예: 김연구"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="channel">채널</label>
          <select
            id="channel"
            value={draft.channel}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                channel: event.target.value as Channel,
              }))
            }
          >
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="start-at">시작 시각</label>
          <input
            id="start-at"
            type="datetime-local"
            step={3600}
            value={draft.startAt}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                startAt: event.target.value,
              }))
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="end-at">종료 시각</label>
          <input
            id="end-at"
            type="datetime-local"
            step={3600}
            value={draft.endAt}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                endAt: event.target.value,
              }))
            }
            required
          />
        </div>

        <div className="field full">
          <label htmlFor="purpose">메모</label>
          <textarea
            id="purpose"
            value={draft.purpose}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                purpose: event.target.value,
              }))
            }
            placeholder="실험 목적이나 전달 메모를 적어 두면 좋습니다."
          />
        </div>

        <div className="action-row">
          <button className="button" type="submit">
            예약 저장
          </button>
          <button
            className="button-ghost"
            type="button"
            onClick={() => setDraft(createDefaultDraft())}
          >
            새로 입력
          </button>
        </div>
      </form>

      <div className="rule-summary section">
        <span>
          시작 예약 가능 범위: 오늘부터 {settings.bookingWindowDays}일 후까지
        </span>
        <span>
          최대 사용 기간: {settings.maxDurationDays}일
        </span>
        <span>
          참고 마감일: {getLatestBookableDate(settings).toLocaleDateString('ko-KR')}
        </span>
      </div>

      {message ? (
        <div className={`inline-message ${message.ok ? 'success' : 'error'}`}>
          {message.text}
        </div>
      ) : null}
    </section>
  );
}
