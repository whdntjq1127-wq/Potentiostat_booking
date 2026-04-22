import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '../components/language-context';
import { ReservationProvider } from '../components/reservation-context';
import { SiteShell } from '../components/site-shell';

export const metadata: Metadata = {
  title: 'Potentiostat Booking Board',
  description:
    'A Potentiostat demo site for managing CH 1, CH 2, and CH 3 bookings by name only',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <ReservationProvider>
            <SiteShell>{children}</SiteShell>
          </ReservationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
