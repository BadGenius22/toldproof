import type { ReactNode } from 'react';
import { PixelMark } from './PixelMark';
import { BRAND_MARK } from './bitmaps';

interface TweetCardProps {
  name: string;
  handle: string;
  time: string;
  body: ReactNode;
  bot?: boolean;
  replying?: boolean;
  verdict?: { tone: 'verified' | 'warn' | 'sealed'; text: string };
  action?: ReactNode;
}

export function TweetCard({
  name,
  handle,
  time,
  body,
  bot = false,
  replying = false,
  verdict,
  action,
}: TweetCardProps) {
  return (
    <div
      className="tweet"
      style={{
        borderLeft: replying ? '3px solid var(--border)' : '1px solid var(--border)',
        borderRadius: replying ? '0 12px 12px 0' : 12,
        marginLeft: replying ? 24 : 0,
      }}
    >
      <div className={`avatar ${bot ? 'bot' : ''}`}>
        {bot ? (
          <PixelMark bitmap={BRAND_MARK} size={22} color="var(--ink)" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="grow">
        <div className="tweet-head">
          <span className="name">{name}</span>
          {bot && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--sealed-soft)',
                color: 'oklch(0.4 0.12 70)',
                padding: '1px 6px',
                borderRadius: 3,
                fontSize: 10,
                fontFamily: 'var(--font-mono), monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                border: '1px solid var(--sealed)',
              }}
            >
              bot
            </span>
          )}
          <span className="handle">@{handle}</span>
          <span className="time">· {time}</span>
        </div>
        <div className="tweet-body">{body}</div>
        {verdict && (
          <div
            className="mt-12"
            style={{
              padding: '10px 12px',
              border: '1px solid',
              borderColor:
                verdict.tone === 'verified'
                  ? 'var(--verified)'
                  : verdict.tone === 'warn'
                    ? 'var(--warn)'
                    : 'var(--sealed)',
              background:
                verdict.tone === 'verified'
                  ? 'var(--verified-soft)'
                  : verdict.tone === 'warn'
                    ? 'var(--warn-soft)'
                    : 'var(--sealed-soft)',
              borderRadius: 6,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 12,
            }}
          >
            <span style={{ fontSize: 16 }}>
              {verdict.tone === 'verified' ? '✓' : verdict.tone === 'warn' ? '○' : '▮'}
            </span>
            <span>{verdict.text}</span>
          </div>
        )}
        {action && (
          <div className="mt-8 row" style={{ gap: 8 }}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
