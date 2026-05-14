import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/Providers';
import { TopBar, FooterBar, ThemeScript } from '../components/design';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TOLDPROOF — proof you called it before it happened',
  description:
    'Lock a prediction today, open it on the date you pick. Anyone can check when you said it. Built on Sui, Walrus, and Seal.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <div
            style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
          >
            <TopBar />
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
            <FooterBar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
