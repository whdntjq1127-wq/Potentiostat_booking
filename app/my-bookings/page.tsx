'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useReservation } from '../../components/reservation-context';
import {
  CHANNELS,
  addHours,
  formatBookingRange,
  getChannelColor,
  getStatusLabel,
  toDateTimeLocal,
  type Channel,
} from '../../lib/reservation-data';

type EditDraft = {
  channel: Channel;
  startAt: string;
  endAt: string;
  purpose: string;
};

export default function MyBookingsPage() {
  const { bookings, cancelBooking, ready, updateBooking } = useReservation();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return [];
    }

    return bookings.filter(
      (booking) => booking.applicant.trim().toLowerCase() === trimmed,
    );
  }, [bookings, query]);

  if (!ready) {
    return (
      <main>
        <section className="panel">
          <div className="eyebrow">불러오는 중</div>
          <h1 className="section-title">예약 목록을 준비하고 있습니다.</h1>
        </section>
      </main>
    );
  }

  function beginEdit(booking: (typeof bookings)[number]) {
    setEditingId(booking.id);
    setEditDraft({
      channel: booking.channel,
      startAt: booking.startAt,
      endAt: booking.endAt,
      purpose: booking.purpose,
    });
    setEditMessage(null);
  }

  return (
    <main className="lookup-layout">
      <section className="panel">
        <div className="eyebrow">내 예약 찾기</div>
        <h1 className="section-title">이름으로 예약 조회</h1>
        <p className="muted">
          로그인 대신 이름으로 예약을 찾습니다. 예약을 등록할 때 사용한 이름과 정확히
          같아야 합니다.
        </p>

        <div className="lookup-bar section">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 김연구"
          />
        </div>

        <div className="reservation-list section">
          {!query.trim() ? (
            <div className="empty-state">
              먼저 사용자 이름을 입력해 내 예약만 좁혀서 보세요.
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">해당 이름으로 등록된 예약이 없습니다.</div>
          ) : (
            filtered.map((booking) => (
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
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="muted">
                  {booking.purpose || '메모 없이 등록된 예약입니다.'}
                </div>

                {booking.status === 'active' ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() =>
                        editingId === booking.id
                          ? setEditingId(null)
                          : beginEdit(booking)
                      }
                    >
                      {editingId === booking.id ? '수정 닫기' : '예약 수정'}
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => cancelBooking(booking.id)}
                    >
                      예약 취소
                    </button>
                  </div>
                ) : null}

                {editingId === booking.id && editDraft ? (
                  <form
                    className="form-grid section edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const result = updateBooking({
                        id: booking.id,
                        channel: editDraft.channel,
                        startAt: editDraft.startAt,
                        endAt: editDraft.endAt,
                        purpose: editDraft.purpose,
                      });
                      setEditMessage(result.message);
                      if (result.ok) {
                        setEditingId(null);
                      }
                    }}
                  >
                    <div className="field">
                      <label htmlFor={`channel-${booking.id}`}>채널</label>
                      <select
                        id={`channel-${booking.id}`}
                        value={editDraft.channel}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  channel: event.target.value as Channel,
                                }
                              : current,
                          )
                        }
                      >
                        {CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor={`start-${booking.id}`}>시작 시각</label>
                      <input
                        id={`start-${booking.id}`}
                        type="datetime-local"
                        step={3600}
                        value={editDraft.startAt}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  startAt: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`end-${booking.id}`}>종료 시각</label>
                      <input
                        id={`end-${booking.id}`}
                        type="datetime-local"
                        step={3600}
                        min={toDateTimeLocal(
                          addHours(new Date(editDraft.startAt), 1),
                        )}
                        value={editDraft.endAt}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  endAt: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor={`purpose-${booking.id}`}>메모</label>
                      <textarea
                        id={`purpose-${booking.id}`}
                        value={editDraft.purpose}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  purpose: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="inline-note">
                      시작과 종료는 1시간 단위로만 입력할 수 있습니다. 예: 13시~18시 가능,
                      13시~18시30분 불가
                    </div>

                    <div className="action-row">
                      <button className="button" type="submit">
                        수정 저장
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => setEditingId(null)}
                      >
                        닫기
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>

        {editMessage ? <div className="inline-message section">{editMessage}</div> : null}
      </section>
    </main>
  );
}
