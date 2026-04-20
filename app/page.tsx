'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useReservation } from '../components/reservation-context';
import { WeeklySchedule, type SelectedSlot } from '../components/weekly-schedule';
import {
  addDays,
  formatDateLabel,
  formatBookingRange,
  getLatestBookableDate,
} from '../lib/reservation-data';

export default function Home() {
  const { ready, addBooking, settings } = useReservation();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [applicant, setApplicant] = useState('');
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setWeekAnchor(current);
    setMounted(true);
  }, []);

  if (!ready || !mounted || !now || !weekAnchor) {
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
    <main className="calendar-page">
      <section className="panel board-panel calendar-panel">
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
              <span>예약 시간: 1시간 고정</span>
              <span>
                <Link href="/my-bookings">내 예약 조회</Link>
              </span>
            </div>
          </div>

          <div className="calendar-inline-booking">
            {selectedSlot ? (
              <>
                <div className="selection-card">
                  <strong>{selectedSlot.channel}</strong>
                  <span>
                    선택 슬롯: {formatBookingRange(selectedSlot.startAt, selectedSlot.endAt)}
                  </span>
                </div>

                <form
                  className="inline-booking-form"
                  onSubmit={(event) => {
                    event.preventDefault();

                    const result = addBooking({
                      applicant,
                      channel: selectedSlot.channel,
                      startAt: selectedSlot.startAt,
                      endAt: selectedSlot.endAt,
                      purpose,
                    });

                    setMessage({ ok: result.ok, text: result.message });

                    if (result.ok) {
                      setApplicant('');
                      setPurpose('');
                      setSelectedSlot(null);
                    }
                  }}
                >
                  <input
                    type="text"
                    value={applicant}
                    onChange={(event) => setApplicant(event.target.value)}
                    placeholder="사용자 이름"
                    required
                  />
                  <input
                    type="text"
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                    placeholder="메모"
                  />
                  <button className="button" type="submit">
                    예약 저장
                  </button>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                  >
                    선택 취소
                  </button>
                </form>
              </>
            ) : (
              <div className="selection-placeholder">
                달력에서 비어 있는 칸을 클릭하면 바로 이 자리에서 예약을 등록할 수
                있습니다.
              </div>
            )}
          </div>

          {message ? (
            <div className={`inline-message ${message.ok ? 'success' : 'error'}`}>
              {message.text}
            </div>
          ) : null}

          <WeeklySchedule
            anchorDate={weekAnchor}
            now={now}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => {
              setSelectedSlot(slot);
              setMessage(null);
            }}
            onShiftWeek={(direction) =>
              setWeekAnchor((current) =>
                current ? addDays(current, direction * 7) : current,
              )
            }
          />
      </section>
    </main>
  );
}
