import Link from 'next/link';

export default function Home() {
  return (
    <section className="flex flex-1 w-full max-w-3xl flex-col items-start gap-8 px-6 py-24">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Sui Overflow 2026 · Walrus Track
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Cryptographic receipts<br />for crypto Twitter.
        </h1>
        <p className="max-w-xl text-lg text-neutral-700 dark:text-neutral-300">
          Sealed predictions on Sui + Walrus + Seal. Time-locked, immutable,
          verifiable. No more hindsight farming.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/seal"
          className="rounded-md bg-black px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Seal a prediction →
        </Link>
        <a
          href="https://github.com/BadGenius22/toldproof"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-300 px-5 py-3 text-sm font-medium hover:border-black dark:border-neutral-700 dark:hover:border-white"
        >
          GitHub
        </a>
      </div>

      <div className="grid w-full gap-6 pt-12 md:grid-cols-3">
        <Step n="1" title="Seal" body="Type your prediction. Pick an unlock date. It's AES-encrypted in your browser; Walrus stores the ciphertext; Seal time-locks the key." />
        <Step n="2" title="Wait" body="Until the unlock moment passes, no one — not even you — can decrypt. The hash is anchored on Sui from second one." />
        <Step n="3" title="Reveal" body="At unlock, the cron decrypts via Seal and posts a tweet quoting the original seal. Skeptics can mention @toldproof verify on any claim." />
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-neutral-500">{n}.</p>
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
    </div>
  );
}
