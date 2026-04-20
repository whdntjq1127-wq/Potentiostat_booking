'use client';

import { useState } from 'react';
import { useReservation } from '../../components/reservation-context';
import { getStatusLabel } from '../../lib/reservation-data';

export default function AdminPage() {
  const { bookings, blockedDates, notices, updateStatus, blockDate, addNotice } =
    useReservation();
  const [blockInput, setBlockInput] = useState('2026-05-02');
  const [noticeInput, setNoticeInput] = useState(
    '장비 사용 후 측정 파일명을 연구실 규칙에 맞게 정리해 주세요.',
  );

  return (
    <main className="grid-2">
      <section className="panel">
        <div className="eyebrow">관리자</div>
        <h1 className="section-title">승인/반려 및 일정 제어</h1>
        <p className="muted">
          실제 권한 인증 없이 동작하는 데모 관리자 화면입니다. 예약 상태 변경,
          점검일 차단, 공지 추가를 즉시 확인할 수 있습니다.
        </p>

        <div className="admin-list section">
          {bookings.map((booking) => (
            <article key={booking.id} className="admin-card">
              <div className="card-head">
                <div>
                  <strong>
                    {booking.applicant} · {booking.date}
                  </strong>
                  <div className="muted">
                    {booking.startTime} - {booking.endTime}
                  </div>
                </div>
                <span className={`status ${booking.status}`}>
                  {getStatusLabel(booking.status)}
                </span>
              </div>
              <div className="muted">{booking.purpose}</div>
              <div className="action-row">
                <button
                  className="button"
                  type="button"
                  onClick={() => updateStatus(booking.id, 'approved')}
                >
                  승인
                </button>
                <button
                  className="button-warning"
                  type="button"
                  onClick={() => updateStatus(booking.id, 'rejected')}
                >
                  반려
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-2" style={{ alignContent: 'start' }}>
        <article className="panel">
          <div className="eyebrow">점검일 차단</div>
          <h2 className="section-title">예약 불가 일정 관리</h2>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="block-date">차단 날짜</label>
              <input
                id="block-date"
                type="date"
                value={blockInput}
                onChange={(event) => setBlockInput(event.target.value)}
              />
            </div>
          </div>
          <div className="action-row">
            <button
              className="button"
              type="button"
              onClick={() => blockDate(blockInput)}
            >
              점검일 차단
            </button>
          </div>
          <div className="notice-list section">
            {blockedDates.map((date) => (
              <div key={date} className="announcement">
                {date}
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">공지 입력</div>
          <h2 className="section-title">운영 안내 추가</h2>
          <div className="field">
            <label htmlFor="notice">공지 내용</label>
            <textarea
              id="notice"
              value={noticeInput}
              onChange={(event) => setNoticeInput(event.target.value)}
            />
          </div>
          <div className="action-row">
            <button
              className="button"
              type="button"
              onClick={() => addNotice(noticeInput)}
            >
              공지 등록
            </button>
          </div>
          <div className="notice-list section">
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
