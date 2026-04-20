'use client';

import { useEffect, useState } from 'react';
import { BookingForm } from '../components/booking-form';
import { useReservation } from '../components/reservation-context';
import { WeeklySchedule, type SelectedSlot } from '../components/weekly-schedule';
import {
  CHANNELS,
  addDays,
  addHours,
  ceilToHour,
  formatDateLabel,
  getLatestBookableDate,
  toDateKey,
  toDateTimeLocal,
} from '../lib/reservation-data';

function createDefaultSlot(now: Date): SelectedSlot {
  const start = ceilToHour(now);
  const end = addHours(start, 1);

  return {
    channel: CHANNELS[0],
    startAt: toDateTimeLocal(start),
    endAt: toDateTimeLocal(end),
  };
}

export default function Home() {
  const { ready, blockedDates, notices, settings } = useReservation();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setWeekAnchor(current);
    setSelectedSlot(createDefaultSlot(current));
    setMounted(true);
  }, []);

  if (!ready || !mounted || !now || !weekAnchor || !selectedSlot) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">불러오는 중</div>
          <h1 className="section-title">주간 예약 보드를 준비하고 있습니다.</h1>
        </section>
      </main>
    );
  }

  const latestBookableDate = getLatestBookableDate(settings, now);

  return (
    <main className="home-stack">
      <section className="hero-card">
        <div>
          <div className="eyebrow">운용 요약</div>
          <h1 className="section-title">Potentiostat 3채널 통합 예약 보드</h1>
          <p className="muted">
            메인 달력에서 원하는 칸을 선택한 뒤 이름만 입력하면 예약할 수 있습니다.
            같은 시간대에는 채널이 달라도 한 사람만 장비를 운용할 수 있습니다.
          </p>
        </div>

        <div className="hero-stats">
          <article className="stat-card">
            <strong>3 채널</strong>
            <span>CH 1 / CH 2 / CH 3</span>
          </article>
          <article className="stat-card">
            <strong>{settings.bookingWindowDays}일</strong>
            <span>오늘부터 예약 가능한 시작 범위</span>
          </article>
          <article className="stat-card">
            <strong>{settings.maxDurationDays}일</strong>
            <span>한 번에 예약 가능한 최대 기간</span>
          </article>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel board-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">주간 달력</div>
              <h2 className="section-title">1주일 예약 현황</h2>
            </div>
            <div className="rule-summary">
              <span>{formatDateLabel(now)} 기준</span>
              <span>
                시작 가능 마감일: {formatDateLabel(latestBookableDate)}
              </span>
            </div>
          </div>

          <WeeklySchedule
            anchorDate={weekAnchor}
            now={now}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            onShiftWeek={(direction) =>
              setWeekAnchor((current) =>
                current ? addDays(current, direction * 7) : current,
              )
            }
          />
        </div>

        <div className="side-column">
          <BookingForm
            title="빠른 예약 등록"
            description="달력에서 칸을 클릭하면 시작 시각과 채널이 자동으로 채워집니다."
            prefill={selectedSlot}
          />

          <section className="panel">
            <div className="eyebrow">현재 규칙</div>
            <h2 className="section-title">예약 조건</h2>
            <div className="info-list">
              <div className="info-item">
                <div className="info-badge">1</div>
                <div>
                  <strong>이름만 입력하면 예약 가능</strong>
                  <p className="muted">로그인 없이 사용자 이름만 필수로 받습니다.</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-badge">2</div>
                <div>
                  <strong>동시간대 중복 예약 불가</strong>
                  <p className="muted">
                    하나의 시간대에는 채널이 달라도 단 한 명만 운용할 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-badge">3</div>
                <div>
                  <strong>시작 가능 범위</strong>
                  <p className="muted">
                    오늘부터 {settings.bookingWindowDays}일 후 날짜까지 시작하는 예약만
                    허용합니다.
                  </p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-badge">4</div>
                <div>
                  <strong>최대 사용 기간</strong>
                  <p className="muted">
                    한 번의 예약은 최대 {settings.maxDurationDays}일까지만 유지됩니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">공지 및 차단일</div>
            <h2 className="section-title">운용 메모</h2>
            <div className="chip-row">
              {blockedDates.length === 0 ? (
                <span className="chip">차단된 날짜 없음</span>
              ) : (
                blockedDates.map((dateKey) => (
                  <span key={dateKey} className="chip">
                    {dateKey}
                  </span>
                ))
              )}
            </div>
            <div className="notice-list section">
              {notices.map((notice) => (
                <div key={notice} className="announcement">
                  {notice}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
