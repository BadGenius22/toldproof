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
    async getMentions({ sinceId, max = 20 }) {
      // X API v2: GET /2/users/:id/mentions
      // Requires the bot's USER_ID (not the bearer-token-owning user — we need
      // the @toldproof account's numeric ID; lookup at /2/users/me first).
      const me = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!me.ok) {
        console.warn(`[x.ts] getMentions: /users/me failed ${me.status}`);
        return [];
      }
      const meData = (await me.json()) as { data: { id: string } };
      const userId = meData.data.id;

      const params = new URLSearchParams({
        max_results: String(Math.min(Math.max(max, 5), 100)),
        'tweet.fields': 'author_id,created_at,referenced_tweets,in_reply_to_user_id',
        expansions: 'referenced_tweets.id,author_id',
      });
      if (sinceId) params.set('since_id', sinceId);

      const res = await fetch(
        `https://api.twitter.com/2/users/${userId}/mentions?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        console.warn(`[x.ts] getMentions failed: ${res.status} ${await res.text()}`);
        return [];
      }
      const data = (await res.json()) as {
        data?: Array<{
          id: string;
          text: string;
          author_id: string;
          referenced_tweets?: Array<{ type: string; id: string }>;
        }>;
      };
      return (data.data ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        authorId: t.author_id,
        inReplyToTweetId: t.referenced_tweets?.find((r) => r.type === 'replied_to')?.id,
      }));
    },
  };
}

// Fetch a tweet (used to fetch the PARENT of a mention to know what's being verified).
export async function fetchTweet(
  token: string,
  tweetId: string,
): Promise<{ id: string; text: string; authorHandle: string } | null> {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?` +
        new URLSearchParams({
          'tweet.fields': 'author_id',
          expansions: 'author_id',
          'user.fields': 'username',
        }),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data: { id: string; text: string; author_id: string };
      includes?: { users: Array<{ id: string; username: string }> };
    };
    const author = data.includes?.users.find((u) => u.id === data.data.author_id);
    return {
      id: data.data.id,
      text: data.data.text,
      authorHandle: author?.username ?? '',
    };
  } catch (e) {
    console.warn(`[x.ts] fetchTweet ${tweetId} threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
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
