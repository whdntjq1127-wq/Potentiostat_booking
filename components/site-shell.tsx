'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: '주간 보드' },
  { href: '/reserve', label: '예약 등록' },
  { href: '/my-bookings', label: '내 예약 조회' },
  { href: '/admin', label: '관리자 설정' },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">
          <div className="brand-mark">PS</div>
          <div className="brand-copy">
            <strong>Potentiostat 예약 보드</strong>
            <span>CH 1, CH 2, CH 3 통합 예약 데모</span>
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
        이 화면은 브라우저 안에서만 동작하는 데모입니다. 로그인은 없고, 관리자 규칙도
        현재 브라우저에만 저장됩니다.
      </div>
    </div>
  );
}
