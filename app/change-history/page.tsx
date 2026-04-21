'use client';

import { useReservation } from '../../components/reservation-context';
import {
  formatDateTimeLabel,
  getChangeActionLabel,
} from '../../lib/reservation-data';

export default function ChangeHistoryPage() {
  const { changeLogs, ready } = useReservation();

  if (!ready) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">Loading</div>
          <h1 className="section-title">Preparing the booking change history.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="lookup-layout">
      <section className="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Public Logbook</div>
            <h1 className="section-title">Booking Change History</h1>
          </div>
          <div className="muted">
            Booking creation, edits, cancellations, and admin changes are all
            recorded here.
          </div>
        </div>

        <div className="logbook-list section">
          {changeLogs.length === 0 ? (
            <div className="empty-state">No changes have been recorded yet.</div>
          ) : (
            changeLogs.map((entry) => (
              <article key={entry.id} className="log-entry">
                <div className="card-head">
                  <div className="log-meta">
                    <span className="log-actor">{entry.actor}</span>
                    <span className="muted">
                      {formatDateTimeLabel(entry.createdAt)}
                    </span>
                  </div>
                  <span className="chip">
                    {getChangeActionLabel(entry.action)}
                  </span>
                </div>
                <div>{entry.summary}</div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
