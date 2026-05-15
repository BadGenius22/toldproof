'use client';

import { useState } from 'react';

interface ShareButtonProps {
  text: string;
  url: string;
  variant?: 'primary' | 'ghost';
  label?: string;
}

export function ShareButton({
  text,
  url,
  variant = 'ghost',
  label = 'Share on X',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text + '\n\n' + url)}`;

  return (
    <div className="row" style={{ gap: 8 }}>
      <a
        href={intent}
        target="_blank"
        rel="noreferrer"
        className={`btn${variant === 'ghost' ? ' ghost' : ''}`}
      >
        𝕏 {label}
      </a>
      <button
        type="button"
        className="btn ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked — silent no-op */
          }
        }}
      >
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
    </div>
  );
}
