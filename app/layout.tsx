import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '../components/language-context';
import { ReservationProvider } from '../components/reservation-context';
import { SiteShell } from '../components/site-shell';

export const metadata: Metadata = {
  title: 'Potentiostat Booking Board',
  description:
    'A Potentiostat site for managing CH 1 through CH 5 bookings by name only',
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
