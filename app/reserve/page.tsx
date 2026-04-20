'use client';

import { useState } from 'react';
import { useReservation } from '../../components/reservation-context';

export default function ReservePage() {
  const { addBooking, blockedDates, notices } = useReservation();
  const [form, setForm] = useState({
    date: '2026-04-27',
    startTime: '10:00',
    endTime: '12:00',
    purpose: '전해질 조성 변화에 따른 impedance 분석',
  });
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="grid-2">
      <section className="panel">
        <div className="eyebrow">예약 신청</div>
        <h1 className="section-title">장비 사용 일정을 등록하세요</h1>
        <p className="muted">
          실제 로그인 없이 데모 데이터로 작동합니다. 신청 즉시 내 예약 목록에
          추가되며, 기본 상태는 승인 대기입니다.
        </p>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            addBooking(form);
            setSubmitted(true);
          }}
        >
          <div className="field">
            <label htmlFor="date">예약 날짜</label>
            <input
              id="date"
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="purpose-type">실험 유형</label>
            <select
              id="purpose-type"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  purpose:
                    event.target.value === 'custom'
                      ? current.purpose
                      : event.target.value,
                }))
              }
              defaultValue="전해질 조성 변화에 따른 impedance 분석"
            >
              <option>전해질 조성 변화에 따른 impedance 분석</option>
              <option>전극 샘플의 cyclic voltammetry 측정</option>
              <option>장시간 galvanostatic stability 테스트</option>
              <option value="custom">직접 입력</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="startTime">시작 시간</label>
            <input
              id="startTime"
              type="time"
              value={form.startTime}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startTime: event.target.value,
                }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="endTime">종료 시간</label>
            <input
              id="endTime"
              type="time"
              value={form.endTime}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endTime: event.target.value,
                }))
              }
            />
          </div>

          <div className="field full">
            <label htmlFor="purpose">사용 목적</label>
            <textarea
              id="purpose"
              value={form.purpose}
              onChange={(event) =>
                setForm((current) => ({ ...current, purpose: event.target.value }))
              }
            />
          </div>

          <div className="action-row">
            <button className="button" type="submit">
              예약 신청 등록
            </button>
            <button
              className="button-ghost"
              type="button"
              onClick={() =>
                setForm({
                  date: '2026-04-27',
                  startTime: '10:00',
                  endTime: '12:00',
                  purpose: '전해질 조성 변화에 따른 impedance 분석',
                })
              }
            >
              예시값으로 되돌리기
            </button>
          </div>
        </form>

        {submitted ? (
          <div className="note-box" style={{ marginTop: 18 }}>
            <strong>예약 신청이 추가되었습니다.</strong>
            <p className="muted">
              내 예약 페이지에서 방금 등록한 신청 건과 상태를 확인할 수 있습니다.
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="eyebrow">운영 참고</div>
        <h2 className="section-title">예약 전 확인 사항</h2>

        <div className="info-list">
          <div className="info-item">
            <div className="info-badge">1</div>
            <div>
              <strong>점검일 차단 일정</strong>
              <p className="muted">
                {blockedDates.length > 0
                  ? blockedDates.join(', ')
                  : '현재 등록된 차단 일정이 없습니다.'}
              </p>
            </div>
          </div>

          <div className="info-item">
            <div className="info-badge">2</div>
            <div>
              <strong>실험 준비</strong>
              <p className="muted">
                샘플, 전해질, 전극 상태를 미리 점검하고 필요한 소모품을 준비해
                주세요.
              </p>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">공지</div>
              <h3 className="section-title" style={{ fontSize: '1.5rem' }}>
                최근 안내
              </h3>
            </div>
          </div>
          <div className="notice-list">
            {notices.map((notice) => (
              <div key={notice} className="announcement">
                {notice}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
