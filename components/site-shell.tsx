'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: '홈' },
  { href: '/reserve', label: '예약 신청' },
  { href: '/my-bookings', label: '내 예약' },
  { href: '/admin', label: '관리자' },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">
          <div className="brand-mark">PS</div>
          <div className="brand-copy">
            <strong>Potentiostat 예약 시스템</strong>
            <span>연구실 장비 사용 예약 · 데모 모드</span>
          </div>
        </div>
        <nav className="nav-links" aria-label="주요 메뉴">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className="nav-link"
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="page">{children}</div>
      <div className="footer-note">
        본 사이트는 1단계 데모 버전으로, 로그인과 실제 예약 확정 연동 없이 예시
        데이터로 동작합니다.
      </div>
    </div>
  );
}
