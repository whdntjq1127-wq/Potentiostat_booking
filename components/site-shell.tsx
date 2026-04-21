'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Weekly Board' },
  { href: '/my-bookings', label: 'My Bookings' },
  { href: '/change-history', label: 'Booking Change History' },
  { href: '/admin', label: 'Admin Settings' },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">
          <div className="brand-mark">PS</div>
          <div className="brand-copy">
            <strong>Potentiostat Booking Board</strong>
            <span>CH 1, CH 2, CH 3 integrated booking demo</span>
          </div>
        </div>
        <nav className="nav-links" aria-label="Primary navigation">
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
        This is a browser-only demo. There is no login, and admin rules are stored
        only in the current browser.
      </div>
    </div>
  );
}
