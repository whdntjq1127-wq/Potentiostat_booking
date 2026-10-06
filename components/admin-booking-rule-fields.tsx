import { translations, type Language } from '../lib/i18n';
import {
  addDays,
  getBookingToday,
  getBookingWindowEnd,
  getLatestBookableDate,
  toDateKey,
  type ReservationSettings,
} from '../lib/reservation-data';

type Props = {
  language: Language;
  now: Date | null;
  settings: ReservationSettings;
  onChange: (settings: ReservationSettings) => void;
  disabled: boolean;
};

export function AdminBookingRuleFields({ language, now, settings, onChange, disabled }: Props) {
  const copy = translations[language].adminRules;
  const valid = Number.isSafeInteger(settings.bookingWindowDays) && settings.bookingWindowDays >= 1
    && Number.isSafeInteger(settings.maxDurationDays) && settings.maxDurationDays >= 1;
  const today = now ? getBookingToday(now) : null;
  const lastDay = now && valid ? getLatestBookableDate(settings, now) : null;
  const deadline = now && valid ? getBookingWindowEnd(settings, now) : null;
  const canPreview = today && lastDay && deadline && Number.isFinite(deadline.getTime());

  return (
    <>
      <div className="field">
        <label htmlFor="booking-window">{copy.windowLabel}</label>
        <input id="booking-window" type="number" min={1} step={1} required
          aria-describedby="booking-window-help" disabled={disabled}
          value={Number.isFinite(settings.bookingWindowDays) ? settings.bookingWindowDays : ''}
          onChange={(event) => onChange({ ...settings, bookingWindowDays: Number(event.target.value) })} />
        <p id="booking-window-help" className="muted admin-rule-help">{copy.windowHelp}</p>
      </div>
      <div className="field">
        <label htmlFor="max-duration">{copy.durationLabel}</label>
        <input id="max-duration" type="number" min={1} step={1} required
          aria-describedby="max-duration-help" disabled={disabled}
          value={Number.isFinite(settings.maxDurationDays) ? settings.maxDurationDays : ''}
          onChange={(event) => onChange({ ...settings, maxDurationDays: Number(event.target.value) })} />
        <p id="max-duration-help" className="muted admin-rule-help">
          {valid ? copy.durationHelp(settings.maxDurationDays) : copy.invalidDraft}
        </p>
      </div>
      <section className="field full admin-rules-preview" aria-labelledby="rules-preview-title" aria-live="polite">
        <h2 id="rules-preview-title">{copy.previewTitle}</h2>
        <p className="muted admin-rule-help">{copy.previewHint}</p>
        {canPreview ? (
          <>
            <dl className="admin-rules-dates">
              <div><dt>{copy.dateRange}</dt><dd>{toDateKey(today)} ~ {toDateKey(lastDay)}</dd></div>
              <div><dt>{copy.deadline}</dt><dd>{toDateKey(deadline)} 00:00</dd></div>
            </dl>
            <p className="admin-rule-help">{copy.nextOpening(`${toDateKey(addDays(today, 1))} 00:00`, toDateKey(deadline))}</p>
            <p className="muted admin-rule-help">{copy.exclusions}</p>
          </>
        ) : now ? <p className="admin-rule-help">{copy.invalidDraft}</p> : null}
      </section>
      <aside className="field full admin-rules-flow" aria-labelledby="rules-flow-title">
        <h2 id="rules-flow-title">{copy.flowTitle}</h2>
        <p className="admin-rule-help">{copy.flow}</p>
        <p className="muted admin-rule-help">{copy.queueNote}</p>
      </aside>
    </>
  );
}
