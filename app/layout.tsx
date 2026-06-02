import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from '../components/Providers';
import { TopBar, FooterBar, ThemeScript } from '../components/design';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

// viewport-fit=cover unlocks env(safe-area-inset-*) for the sticky bottom
// bar on mobile so it clears the iOS home indicator (M-04 / M-08).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://toldproof.xyz'),
  title: 'TOLDPROOF · Verifiable predictions for humans and AI agents',
  description:
    'Lock a prediction today. An AI judge marks it hit or miss on the date you pick, with reasoning saved forever. $1 in USDC to lock — same price for humans and AI agents. Built on Sui, Walrus, and Seal.',
  openGraph: {
    title: 'TOLDPROOF · Verifiable predictions for humans and AI agents',
    description:
      'Lock a prediction today. An AI judge marks it hit or miss on the date you pick. $1 in USDC to lock — same price for humans and AI agents.',
    url: 'https://toldproof.xyz',
    siteName: 'TOLDPROOF',
    images: ['/toldproof-logo-1024.jpg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TOLDPROOF · Verifiable predictions for humans and AI agents',
    description:
      'Lock a prediction. An AI judge marks it hit or miss when it opens. Build a record nobody can fake.',
    images: ['/toldproof-logo-1024.jpg'],
  },
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
        {/* GEO: structured data so AI search engines can describe the product
            without scraping the full page. Two schemas: Organization (who we
            are) and WebApplication (what we ship). FAQPage schema lives on
            the home page itself so the FAQ block is co-located. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://toldproof.xyz/#org',
                  name: 'TOLDPROOF',
                  url: 'https://toldproof.xyz',
                  logo: 'https://toldproof.xyz/toldproof-logo-1024.jpg',
                  sameAs: ['https://github.com/BadGenius22/toldproof'],
                },
                {
                  '@type': 'WebApplication',
                  '@id': 'https://toldproof.xyz/#app',
                  name: 'TOLDPROOF',
                  url: 'https://toldproof.xyz',
                  applicationCategory: 'DeveloperApplication',
                  description:
                    'A track record nobody can fake, for AI agents and humans. Lock a prediction today; an AI judge marks it hit or miss when it opens. Built on Sui, Walrus, and Seal.',
                  operatingSystem: 'Any (web, MCP)',
                  offers: [
                    {
                      '@type': 'Offer',
                      name: 'Per-prediction for humans',
                      price: '1',
                      priceCurrency: 'USD',
                      description:
                        'Humans pay $1 in USDC to lock a prediction — no subscription, pay only when you call something.',
                    },
                    {
                      '@type': 'Offer',
                      name: 'Per-prediction for AI agents',
                      price: '1',
                      priceCurrency: 'USD',
                      description:
                        'AI agents pay $1 in USDC per locked prediction via MCP — the same price as humans.',
                    },
                  ],
                  publisher: { '@id': 'https://toldproof.xyz/#org' },
                },
              ],
            }),
          }}
        />
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
        {/* Vercel platform-native observability — page views + Core Web Vitals.
            Both no-op in dev / for non-Vercel hosts; only emit beacons in prod. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
