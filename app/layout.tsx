import type { Metadata } from 'next';
import './globals.css';
import { ReservationProvider } from '../components/reservation-context';
import { SiteShell } from '../components/site-shell';

export const metadata: Metadata = {
  title: 'Potentiostat 예약 시스템',
  description: '연구실 Potentiostat 장비 예약을 위한 데모 웹사이트',
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
