// @toldproof verify — bot logic.
//
// Given a parent tweet (the claim being verified) and its author's X handle,
// query the on-chain Registry for any predictions sealed under that handle and
// compose a verdict reply.
//
// DEFAMATION-SAFE wording per CLAUDE.md non-negotiables:
//   - Never assert a claim is false.
//   - Use "No sealed prediction found" / "Absence of proof is not proof of falsehood".
//   - Reactive only — never proactive.

import type { SuiClient } from './sui';
import { getPredictionsForHandle, type PredictionView } from './registry';

export type Verdict =
  | { kind: 'matched'; predictions: PredictionView[]; text: string }
  | { kind: 'none'; xHandle: string; text: string }
  | { kind: 'rate_limited'; xHandle: string; text: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://toldproof.xyz';

export function rateLimitedReply(xHandle: string): Verdict {
  return {
    kind: 'rate_limited',
    xHandle,
    text: `Rate limit reached for verification requests today. Try again tomorrow.`,
  };
}

export function noProofReply(xHandle: string): Verdict {
  return {
    kind: 'none',
    xHandle,
    text:
      `No sealed prediction found for @${xHandle} via toldproof. ` +
      `Absence of proof is not proof of falsehood. ` +
      `Seal yours: ${APP_URL}`,
  };
}

function matchedReply(xHandle: string, predictions: PredictionView[]): Verdict {
  const n = predictions.length;
  const revealedCount = predictions.filter((p) => p.revealed).length;
  // Profile link encodes the case both ways — single + multi.
  const summary =
    n === 1
      ? `1 sealed prediction (${revealedCount} revealed)`
      : `${n} sealed predictions (${revealedCount} revealed)`;
  return {
    kind: 'matched',
    predictions,
    text:
      `toldproof: @${xHandle} has ${summary} on-chain. ` +
      `Profile: ${APP_URL}/${xHandle}`,
  };
}

// Compose the verdict for a single mention.
// xHandle = the parent tweet's author handle (lowercased, no '@').
export async function composeVerdict(
  client: SuiClient,
  xHandle: string,
): Promise<Verdict> {
  const clean = xHandle.toLowerCase().replace(/^@/, '');
  const predictions = await getPredictionsForHandle(client, clean);
  if (predictions.length === 0) return noProofReply(clean);
  return matchedReply(clean, predictions);
}
