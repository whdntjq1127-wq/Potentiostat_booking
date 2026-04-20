'use client';

import { useEffect, useState } from 'react';
import { BookingForm } from '../../components/booking-form';
import { useReservation } from '../../components/reservation-context';
import { formatDateLabel, getLatestBookableDate } from '../../lib/reservation-data';

export default function ReservePage() {
  const { ready, blockedDates, notices, settings } = useReservation();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    setMounted(true);
  }, []);

  if (!ready || !mounted || !now) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">불러오는 중</div>
          <h1 className="section-title">예약 입력 화면을 준비하고 있습니다.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-grid">
      <BookingForm
        title="예약 직접 등록"
        description="달력을 누르지 않고도 시작 시각과 종료 시각을 직접 입력할 수 있습니다."
      />

      <section className="side-column">
        <article className="panel">
          <div className="eyebrow">예약 체크</div>
          <h2 className="section-title">입력 전 확인</h2>
          <div className="info-list">
            <div className="info-item">
              <div className="info-badge">A</div>
              <div>
                <strong>사용자 이름 필수</strong>
                <p className="muted">로그인 없이 예약하므로 이름이 유일한 식별자입니다.</p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-badge">B</div>
              <div>
                <strong>시작 가능 마감일</strong>
                <p className="muted">
                  현재는 {formatDateLabel(getLatestBookableDate(settings, now))}까지
                  시작하는 예약만 등록할 수 있습니다.
                </p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-badge">C</div>
              <div>
                <strong>최대 사용 기간</strong>
                <p className="muted">
                  한 번의 예약은 최대 {settings.maxDurationDays}일까지만 유지됩니다.
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">차단 일정</div>
          <h2 className="section-title">예약 불가 날짜</h2>
          <div className="chip-row">
            {blockedDates.length === 0 ? (
              <span className="chip">차단된 날짜 없음</span>
            ) : (
              blockedDates.map((date) => (
                <span key={date} className="chip">
                  {date}
                </span>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">공지</div>
          <h2 className="section-title">운용 메모</h2>
          <div className="notice-list">
            {notices.map((notice) => (
              <div key={notice} className="announcement">
                {notice}
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
