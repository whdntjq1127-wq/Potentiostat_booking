import { formatShortDateLabelForLanguage, translations, type Language } from '../lib/i18n';
import { addDays, type ReservationSettings } from '../lib/reservation-data';

export function BookingOpeningNotice({
  language,
  settings,
  unavailable = false,
}: {
  language: Language;
  settings: ReservationSettings | null;
  unavailable?: boolean;
}) {
  const copy = translations[language].openingNotice;
  const daysAhead = settings && !unavailable ? Math.max(1, Math.floor(settings.bookingWindowDays)) - 1 : null;
  // An explicitly labeled example, independent of today's date and the viewer's timezone.
  const opening = new Date(2026, 9, 21);
  const usage = daysAhead === null ? null : addDays(opening, daysAhead);
  const label = (date: Date) => formatShortDateLabelForLanguage(date, language);

  return (
    <aside className="booking-opening-notice" aria-labelledby="booking-opening-title">
      <div className="booking-opening-label">{copy.title}</div>
      <h1 id="booking-opening-title">{unavailable ? copy.unavailable : daysAhead === null ? copy.loading : copy.headline(daysAhead)}</h1>
      <p>{copy.explanation}</p>
      {usage ? (
        <>
          <div className="booking-opening-example">
            <div><span>{copy.exampleOpening}</span><strong>{label(opening)} 00:00</strong></div>
            <span className="booking-opening-arrow" aria-hidden="true">→</span>
            <div><span>{copy.exampleDate}</span><strong>{label(usage)}</strong></div>
          </div>
          <p className="booking-opening-range">{copy.range(label(usage), label(addDays(usage, 1)))}</p>
        </>
      ) : null}
    </aside>
  );
}
