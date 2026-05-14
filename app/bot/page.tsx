// Bot demo screen — mock @toldproof verify threads on X. Demo-only; the real
// bot lives at app/api/cron/verify-bot/route.ts and reads on-chain Registry.

import { BotScenarios } from './BotScenarios';

export default function BotPage() {
  return <BotScenarios />;
}
