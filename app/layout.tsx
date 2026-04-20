import type { Metadata } from 'next';
import './globals.css';
import { ReservationProvider } from '../components/reservation-context';
import { SiteShell } from '../components/site-shell';

export const metadata: Metadata = {
  title: 'Potentiostat 예약 보드',
  description: '이름만 입력해 CH 1, CH 2, CH 3 예약을 관리하는 Potentiostat 데모 사이트',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ReservationProvider>
          <SiteShell>{children}</SiteShell>
        </ReservationProvider>
      </body>
    </html>
  );
}
