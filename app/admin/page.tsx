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
          <div className="eyebrow">Loading</div>
          <h1 className="section-title">Preparing the admin page.</h1>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-gate-page">
        <section className="panel admin-gate-card">
          <div className="eyebrow">Admin Access</div>
          <h1 className="section-title">Enter the password to open admin settings.</h1>
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

              setAuthMessage('The password is incorrect.');
            }}
          >
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              placeholder="Admin password"
            />
            <button className="button" type="submit">
              Open Admin Page
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
            <div className="eyebrow">Booking Rules</div>
            <h1 className="section-title">Admin Settings</h1>
            <p className="muted">
              Adjust the start-date booking window and the maximum usage duration from
              the selected start time.
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
            Lock
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
            <label htmlFor="booking-window">Booking Window (days)</label>
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
            <label htmlFor="max-duration">Maximum Usage Duration (days)</label>
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
              Save Rules
            </button>
          </div>
        </form>

        {settingsMessage ? <div className="inline-message">{settingsMessage}</div> : null}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="eyebrow">Blocked Dates</div>
          <h2 className="section-title">Unavailable Dates</h2>
          <form
            className="form-grid section"
            onSubmit={(event) => {
              event.preventDefault();
              const result = addBlockedDate(blockedDateInput);
              setBlockedMessage(result.message);
            }}
          >
            <div className="field full">
              <label htmlFor="blocked-date">Date to Block</label>
              <input
                id="blocked-date"
                type="date"
                value={blockedDateInput}
                onChange={(event) => setBlockedDateInput(event.target.value)}
              />
            </div>
            <div className="action-row">
              <button className="button" type="submit">
                Block Date
              </button>
            </div>
          </form>
          {blockedMessage ? <div className="inline-message">{blockedMessage}</div> : null}
          <div className="chip-row section">
            {blockedDates.length === 0 ? (
              <span className="chip">No blocked dates</span>
            ) : (
              blockedDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className="chip removable-chip"
                  onClick={() => removeBlockedDate(date)}
                >
                  Remove {date}
                </button>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Notice Management</div>
          <h2 className="section-title">Operation Notes</h2>
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
              <label htmlFor="notice">Notice Content</label>
              <textarea
                id="notice"
                value={noticeInput}
                onChange={(event) => setNoticeInput(event.target.value)}
                placeholder="Enter a new operation rule or notice."
              />
            </div>
            <div className="action-row">
              <button className="button" type="submit">
                Add Notice
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
                  Delete
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="eyebrow">Current Bookings</div>
        <h2 className="section-title">Registered Booking List</h2>
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
                  {booking.status === 'active' ? 'Booked' : 'Cancelled'}
                </span>
              </div>
              <div className="muted">
                {booking.purpose || 'This booking has no memo.'}
              </div>
              {booking.status === 'active' ? (
                <div className="action-row">
                  <button
                    type="button"
                    className="button-warning"
                    onClick={() =>
                      cancelBooking({
                        id: booking.id,
                        requestedBy: 'Admin',
                      })
                    }
                  >
                    Admin Cancel
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
