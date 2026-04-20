'use client';

import { useReservation } from '../../components/reservation-context';
import { getStatusLabel } from '../../lib/reservation-data';

export default function MyBookingsPage() {
  const { bookings, cancelBooking } = useReservation();

  return (
    <main>
      <section className="panel">
        <div className="eyebrow">내 예약</div>
        <h1 className="section-title">예약 목록과 상태 확인</h1>
        <p className="muted">
          데모 모드에서는 동일 브라우저 세션 안에서 생성한 예약이 목록에
          반영됩니다. 승인 대기 또는 승인 상태의 예약은 취소 버튼으로 종료할 수
          있습니다.
        </p>

        <div className="reservation-list section">
          {bookings.length === 0 ? (
            <div className="empty-state">현재 표시할 예약이 없습니다.</div>
          ) : (
            bookings.map((booking) => (
              <article key={booking.id} className="reservation-card">
                <div className="card-head">
                  <div>
                    <strong>{booking.equipment}</strong>
                    <div className="muted">
                      {booking.applicant} · {booking.affiliation}
                    </div>
                  </div>
                  <span className={`status ${booking.status}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="reservation-meta">
                  <span>{booking.date}</span>
                  <span>
                    {booking.startTime} - {booking.endTime}
                  </span>
                </div>

                <div>
                  <strong>사용 목적</strong>
                  <p className="muted">{booking.purpose}</p>
                </div>

                {(booking.status === 'approved' || booking.status === 'pending') && (
                  <div className="action-row">
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => cancelBooking(booking.id)}
                    >
                      예약 취소
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
