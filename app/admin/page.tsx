'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useReservation } from '../../components/reservation-context';
import {
  formatBookingRange,
  getChannelColor,
  toDateKey,
} from '../../lib/reservation-data';

const ADMIN_PASSWORD = '001127';
const ADMIN_SESSION_KEY = 'potentiostat-admin-auth';

export default function AdminPage() {
  const {
    ready,
    bookings,
    blockedDates,
    notices,
    settings,
    updateSettings,
    addBlockedDate,
    removeBlockedDate,
    addNotice,
    removeNotice,
    cancelBooking,
  } = useReservation();
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [blockedDateInput, setBlockedDateInput] = useState('');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [noticeInput, setNoticeInput] = useState('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setSettingsDraft(settings);
    setBlockedDateInput(toDateKey(new Date()));
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setAuthenticated(window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'yes');
  }, []);

  if (!ready) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">불러오는 중</div>
          <h1 className="section-title">관리자 화면을 준비하고 있습니다.</h1>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-gate-page">
        <section className="panel admin-gate-card">
          <div className="eyebrow">관리자 인증</div>
          <h1 className="section-title">비밀번호를 입력해 관리자 설정에 들어가세요.</h1>
          <form
            className="section admin-gate-form"
            onSubmit={(event) => {
              event.preventDefault();

              if (passwordInput === ADMIN_PASSWORD) {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'yes');
                }
                setAuthenticated(true);
                setAuthMessage(null);
                setPasswordInput('');
                return;
              }

              setAuthMessage('비밀번호가 올바르지 않습니다.');
            }}
          >
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              placeholder="관리자 비밀번호"
            />
            <button className="button" type="submit">
              관리자 페이지 열기
            </button>
          </form>
          {authMessage ? <div className="inline-message error">{authMessage}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      <section className="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">예약 규칙</div>
            <h1 className="section-title">관리자 설정</h1>
            <p className="muted">
              이 페이지에서는 예약 가능 범위와 최대 사용 기간을 직접 바꿀 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
              }
              setAuthenticated(false);
            }}
          >
            잠금
          </button>
        </div>

        <form
          className="form-grid section"
          onSubmit={(event) => {
            event.preventDefault();
            const result = updateSettings(settingsDraft);
            setSettingsMessage(result.message);
          }}
        >
          <div className="field">
            <label htmlFor="booking-window">예약 가능 범위 (일)</label>
            <input
              id="booking-window"
              type="number"
              min={0}
              value={settingsDraft.bookingWindowDays}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  bookingWindowDays: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="max-duration">최대 사용 기간 (일)</label>
            <input
              id="max-duration"
              type="number"
              min={1}
              value={settingsDraft.maxDurationDays}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  maxDurationDays: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="action-row">
            <button className="button" type="submit">
              규칙 저장
            </button>
          </div>
        </form>

        {settingsMessage ? <div className="inline-message">{settingsMessage}</div> : null}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="eyebrow">차단 날짜</div>
          <h2 className="section-title">예약 불가 일정</h2>
          <form
            className="form-grid section"
            onSubmit={(event) => {
              event.preventDefault();
              const result = addBlockedDate(blockedDateInput);
              setBlockedMessage(result.message);
            }}
          >
            <div className="field full">
              <label htmlFor="blocked-date">차단할 날짜</label>
              <input
                id="blocked-date"
                type="date"
                value={blockedDateInput}
                onChange={(event) => setBlockedDateInput(event.target.value)}
              />
            </div>
            <div className="action-row">
              <button className="button" type="submit">
                날짜 차단
              </button>
            </div>
          </form>
          {blockedMessage ? <div className="inline-message">{blockedMessage}</div> : null}
          <div className="chip-row section">
            {blockedDates.length === 0 ? (
              <span className="chip">차단된 날짜 없음</span>
            ) : (
              blockedDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className="chip removable-chip"
                  onClick={() => removeBlockedDate(date)}
                >
                  {date} 삭제
                </button>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">공지 관리</div>
          <h2 className="section-title">운용 메모</h2>
          <form
            className="section"
            onSubmit={(event) => {
              event.preventDefault();
              const result = addNotice(noticeInput);
              setNoticeMessage(result.message);
              if (result.ok) {
                setNoticeInput('');
              }
            }}
          >
            <div className="field">
              <label htmlFor="notice">공지 내용</label>
              <textarea
                id="notice"
                value={noticeInput}
                onChange={(event) => setNoticeInput(event.target.value)}
                placeholder="새로운 운용 규칙이나 공지를 입력하세요."
              />
            </div>
            <div className="action-row">
              <button className="button" type="submit">
                공지 추가
              </button>
            </div>
          </form>
          {noticeMessage ? <div className="inline-message">{noticeMessage}</div> : null}
          <div className="notice-list section">
            {notices.map((notice) => (
              <div key={notice} className="announcement removable-announcement">
                <span>{notice}</span>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => removeNotice(notice)}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="eyebrow">현재 예약</div>
        <h2 className="section-title">등록된 예약 목록</h2>
        <div className="reservation-list section">
          {bookings.map((booking) => (
            <article
              key={booking.id}
              className="reservation-card channel-card"
              style={
                {
                  '--channel-color': getChannelColor(booking.channel),
                } as CSSProperties
              }
            >
              <div className="card-head">
                <div>
                  <strong>
                    {booking.applicant} · {booking.channel}
                  </strong>
                  <div className="muted">{formatBookingRange(booking.startAt, booking.endAt)}</div>
                </div>
                <span className="channel-badge">{booking.channel}</span>
              </div>
              <div className="card-head">
                <span className={`status ${booking.status}`}>
                  {booking.status === 'active' ? '예약 완료' : '취소됨'}
                </span>
              </div>
              <div className="muted">
                {booking.purpose || '메모 없이 등록된 예약입니다.'}
              </div>
              {booking.status === 'active' ? (
                <div className="action-row">
                  <button
                    type="button"
                    className="button-warning"
                    onClick={() => cancelBooking(booking.id)}
                  >
                    관리자 취소
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
