export default function Home() {
  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow">연구실 장비 예약 포털</div>
          <h1>Potentiostat 사용 일정을 한눈에 관리</h1>
          <p>
            전기화학 측정 장비 사용 예약, 운영 정보 확인, 관리자 승인 흐름을
            한국어 기반의 데모 화면으로 구성했습니다. 현재 단계에서는 실제
            로그인 없이 예시 데이터로 동작합니다.
          </p>
          <div className="cta-row">
            <a className="button" href="/reserve">
              예약 신청하기
            </a>
            <a className="button-ghost" href="/my-bookings">
              내 예약 확인
            </a>
          </div>
          <div className="stat-grid">
            <article className="stat-card">
              <strong>09:00-18:00</strong>
              <span>평일 운영 시간</span>
            </article>
            <article className="stat-card">
              <strong>1대</strong>
              <span>공용 Potentiostat 장비</span>
            </article>
            <article className="stat-card">
              <strong>24시간 전</strong>
              <span>사전 예약 권장</span>
            </article>
          </div>
        </div>
        <div className="hero-summary">
          <div className="panel">
            <div className="eyebrow">장비 소개</div>
            <h2 className="section-title">Potentiostat / Galvanostat SP-300</h2>
            <p className="muted">
              CV, CA, CP, EIS 측정을 지원하는 연구실 공용 장비입니다. 배터리,
              촉매, 부식, 전해질 분석 실험에 활용됩니다.
            </p>
            <div className="tag-row">
              <span className="chip blocked">CV</span>
              <span className="chip blocked">EIS</span>
              <span className="chip blocked">Galvanostatic</span>
            </div>
          </div>
          <div className="note-box">
            <strong>운영 메모</strong>
            <p className="muted">
              안전 교육 이수 후 예약 신청이 가능합니다. 사용 직후 전극, 셀,
              케이블 상태를 점검하고 이상이 있으면 관리자에게 즉시 공유해
              주세요.
            </p>
          </div>
        </div>
      </section>

      <section className="section grid-3">
        <article className="timeline-card">
          <div className="eyebrow">운영 시간</div>
          <h2 className="section-title">정규 운영</h2>
          <div className="info-list">
            <div className="info-item">
              <div className="info-badge">평일</div>
              <div>
                <strong>09:00 - 18:00</strong>
                <p className="muted">점심시간 12:00 - 13:00</p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-badge">야간</div>
              <div>
                <strong>사전 승인 필요</strong>
                <p className="muted">장시간 측정은 관리자와 일정 협의</p>
              </div>
            </div>
          </div>
        </article>

        <article className="timeline-card">
          <div className="eyebrow">예약 원칙</div>
          <h2 className="section-title">신청 기준</h2>
          <div className="info-list">
            <div className="info-item">
              <div className="info-badge">1</div>
              <div>
                <strong>실험 목적 명시</strong>
                <p className="muted">측정 종류와 샘플 정보를 간단히 작성</p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-badge">2</div>
              <div>
                <strong>시간 엄수</strong>
                <p className="muted">다음 사용자를 위해 종료 시간 준수</p>
              </div>
            </div>
          </div>
        </article>

        <article className="timeline-card">
          <div className="eyebrow">주의사항</div>
          <h2 className="section-title">실험 전 확인</h2>
          <div className="info-list">
            <div className="info-item">
              <div className="info-badge">A</div>
              <div>
                <strong>기준 전극 상태 점검</strong>
                <p className="muted">오염 여부와 보관 용액 상태 확인</p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-badge">B</div>
              <div>
                <strong>데이터 백업</strong>
                <p className="muted">실험 종료 후 서버 또는 개인 저장소에 복사</p>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
