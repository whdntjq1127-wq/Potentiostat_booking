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
      <div className="eyebrow">Booking Form</div>
      <h2 className="section-title">{title}</h2>
      <p className="muted">{description}</p>

      <form
        className="form-grid section"
        onSubmit={async (event) => {
          event.preventDefault();

          const result = await addBooking(draft);
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
          <label htmlFor="applicant">User Name</label>
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
            placeholder="e.g. Dr. Kim"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="channel">Channel</label>
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
          <label htmlFor="start-at">Start Time</label>
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
          <label htmlFor="end-at">End Time</label>
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
          <label htmlFor="purpose">Memo</label>
          <textarea
            id="purpose"
            value={draft.purpose}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                purpose: event.target.value,
              }))
            }
            placeholder="Add experiment purpose or handoff notes."
          />
        </div>

        <div className="action-row">
          <button className="button" type="submit">
            Save Booking
          </button>
          <button
            className="button-ghost"
            type="button"
            onClick={() => setDraft(createDefaultDraft())}
          >
            Reset
          </button>
        </div>
      </form>

      <div className="rule-summary section">
        <span>
          Start booking window: today through {settings.bookingWindowDays} days later
        </span>
        <span>
          Maximum usage duration: {settings.maxDurationDays} days
        </span>
        <span>
          Reference end date:{' '}
          {getLatestBookableDate(settings).toLocaleDateString('en-US')}
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
