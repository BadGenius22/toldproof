// Reveal demo screen — animated countdown → decrypt → typewriter reveal tweet.
// Demo-only (mock); the real cron lives at app/api/cron/reveal/route.ts.

import { RevealDemo } from './RevealDemo';

export default function RevealPage() {
  return <RevealDemo />;
}
