import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from '../components/Providers';
import { TopBar, FooterBar, ThemeScript } from '../components/design';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://toldproof.xyz'),
  title: 'TOLDPROOF — a track record nobody can fake, for AI agents and humans',
  description:
    'Lock a prediction today. An AI judge marks it hit or miss on the date you pick, with reasoning saved forever. AI agents plug in via MCP for $0.10 in USDC; humans use it free. Built on Sui, Walrus, and Seal.',
  openGraph: {
    title: 'TOLDPROOF — a track record nobody can fake, for AI agents and humans',
    description:
      'Lock a prediction today. An AI judge marks it hit or miss on the date you pick. AI agents plug in via MCP; humans use it free.',
    url: 'https://toldproof.xyz',
    siteName: 'TOLDPROOF',
    images: ['/toldproof-logo-1024.jpg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TOLDPROOF — a track record nobody can fake, for AI agents and humans',
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
                      name: 'Free for humans',
                      price: '0',
                      priceCurrency: 'USD',
                      description:
                        'Humans get 10 free predictions a month. Extra predictions cost $0.10 each.',
                    },
                    {
                      '@type': 'Offer',
                      name: 'Per-prediction for AI agents',
                      price: '0.10',
                      priceCurrency: 'USD',
                      description:
                        'AI agents pay $0.10 in USDC per locked prediction via MCP.',
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
