'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useReservation } from '../components/reservation-context';
import { WeeklySchedule, type SelectedSlot } from '../components/weekly-schedule';
import {
  addDays,
  formatDateLabel,
  formatDateTimeLabel,
  formatBookingRange,
  getLatestBookableDate,
  toDateTimeLocal,
  addHours,
} from '../lib/reservation-data';

export default function Home() {
  const { ready, addBooking, settings } = useReservation();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [applicant, setApplicant] = useState('');
  const [purpose, setPurpose] = useState('');
  const [endAt, setEndAt] = useState('');
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

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    setApplicant('');
    setPurpose('');
    setEndAt(selectedSlot.endAt);
  }, [selectedSlot]);

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
              <span>예약 시간: 1시간 단위</span>
              <span>
                <Link href="/my-bookings">내 예약 조회</Link>
              </span>
            </div>
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

      {selectedSlot ? (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <div>
                <div className="eyebrow">예약 등록</div>
                <h2 className="section-title">선택한 칸으로 예약하기</h2>
              </div>
              <button
                type="button"
                className="button-ghost"
                onClick={() => setSelectedSlot(null)}
              >
                닫기
              </button>
            </div>

            <div className="selection-card modal-selection">
              <strong>{selectedSlot.channel}</strong>
              <span>시작: {formatDateTimeLabel(selectedSlot.startAt)}</span>
              <span>종료: {formatDateTimeLabel(endAt || selectedSlot.endAt)}</span>
            </div>

            <form
              className="form-grid section"
              onSubmit={(event) => {
                event.preventDefault();

                const result = addBooking({
                  applicant,
                  channel: selectedSlot.channel,
                  startAt: selectedSlot.startAt,
                  endAt,
                  purpose,
                });

                setMessage({ ok: result.ok, text: result.message });

                if (result.ok) {
                  setSelectedSlot(null);
                  setApplicant('');
                  setPurpose('');
                  setEndAt('');
                }
              }}
            >
              <div className="field full">
                <label htmlFor="modal-applicant">사용자 이름</label>
                <input
                  id="modal-applicant"
                  type="text"
                  value={applicant}
                  onChange={(event) => setApplicant(event.target.value)}
                  placeholder="예: 김연구"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="modal-start">장비 사용 시작</label>
                <input
                  id="modal-start"
                  type="datetime-local"
                  value={selectedSlot.startAt}
                  readOnly
                />
              </div>

              <div className="field">
                <label htmlFor="modal-end">장비 사용 종료</label>
                <input
                  id="modal-end"
                  type="datetime-local"
                  step={3600}
                  min={toDateTimeLocal(addHours(new Date(selectedSlot.startAt), 1))}
                  value={endAt}
                  onChange={(event) => setEndAt(event.target.value)}
                  required
                />
              </div>

              <div className="field full">
                <label htmlFor="modal-purpose">메모</label>
                <textarea
                  id="modal-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="실험 메모나 전달 내용을 적어 주세요."
                />
              </div>

              <div className="inline-note full-line">
                시작 시각은 클릭한 칸으로 고정됩니다. 종료 시각은 1시간 단위로만 설정할 수
                있고, 시작 시각으로부터 최대 {settings.maxDurationDays}일까지 선택할 수 있습니다.
              </div>

              <div className="action-row">
                <button className="button" type="submit">
                  예약 저장
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setSelectedSlot(null)}
                >
                  취소
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
