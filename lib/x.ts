// X (Twitter) API v2 wrapper — stub for Day 5/6. The functions take tokens as
// args; the route handlers source them from env. When the user provides
// X_BOT_BEARER_TOKEN (after Basic-tier approval), reveal tweets light up
// automatically; without it, the reveal cron still completes the on-chain
// reveal, just doesn't tweet.

const TWEETS_ENDPOINT = 'https://api.twitter.com/2/tweets';

export interface PostedTweet {
  id: string;
  text: string;
}

export interface Mention {
  id: string;
  text: string;
  authorId: string;
  inReplyToTweetId?: string;
}

export interface XClient {
  postTweet(text: string, opts?: { replyToTweetId?: string; quoteTweetId?: string }): Promise<PostedTweet | null>;
  getMentions(opts: { sinceId?: string; max?: number }): Promise<Mention[]>;
}

export function getXBotClient(token: string | undefined): XClient | null {
  if (!token) return null;
  return {
    async postTweet(text, opts) {
      const body: Record<string, unknown> = { text };
      if (opts?.replyToTweetId) body.reply = { in_reply_to_tweet_id: opts.replyToTweetId };
      if (opts?.quoteTweetId) body.quote_tweet_id = opts.quoteTweetId;
      try {
        const res = await fetch(TWEETS_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.warn(`[x.ts] postTweet failed: ${res.status} ${await res.text()}`);
          return null;
        }
        const data = (await res.json()) as { data: { id: string; text: string } };
        return { id: data.data.id, text: data.data.text };
      } catch (e) {
        console.warn(`[x.ts] postTweet threw: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    },
    async getMentions() {
      // Day 7 implementation. Stubbed for now.
      return [];
    },
  };
}

// Compose the reveal tweet body. Defamation-safe wording per CLAUDE.md.
export function revealTweetText(opts: {
  xHandle: string;
  plaintext: string;
  predictionId: string;
  sealedAtMs: number;
  appUrl: string;
}): string {
  const sealedDate = new Date(opts.sealedAtMs).toISOString().slice(0, 10);
  const shortId = `${opts.predictionId.slice(0, 8)}…${opts.predictionId.slice(-4)}`;
  return `VERIFIED ✓ Sealed by @${opts.xHandle} on ${sealedDate}:

"${opts.plaintext}"

Proof: ${opts.appUrl}/verify/${opts.predictionId} · ${shortId}`;
}
