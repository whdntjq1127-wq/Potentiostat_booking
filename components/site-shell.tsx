'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { languageOptions } from '../lib/i18n';
import { useLanguage } from './language-context';

const navItems = [
  { href: '/', labelKey: 'weekly' },
  { href: '/my-bookings', labelKey: 'myBookings' },
  { href: '/change-history', labelKey: 'history' },
  { href: '/admin', labelKey: 'admin' },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { copy, language, setLanguage } = useLanguage();

  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">
          <div className="brand-mark">PS</div>
          <div className="brand-copy">
            <strong>{copy.site.brandTitle}</strong>
            <span>{copy.site.brandSubtitle}</span>
          </div>
        </div>
        <div className="nav-controls">
          <nav className="nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="nav-link"
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {copy.site.nav[item.labelKey]}
              </Link>
            ))}
          </nav>
          <label className="language-picker">
            <span>{copy.site.languageLabel}</span>
            <select
              value={language}
              aria-label={copy.site.languageAriaLabel}
              onChange={(event) =>
                setLanguage(event.target.value === 'ko' ? 'ko' : 'en')
              }
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="page">{children}</div>
      <div className="footer-note">{copy.site.footer}</div>
    </div>
  );
}
