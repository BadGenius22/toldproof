// Format helpers shared by the design surfaces.

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export function shortHash(h: string | undefined | null, head = 8, tail = 6): string {
  if (!h) return '';
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function fmtAbs(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function fmtRel(ms: number, now = Date.now()): string {
  const delta = ms - now;
  const abs = Math.abs(delta);
  const past = delta < 0;
  let v: number;
  let unit: string;
  if (abs < 60_000) {
    v = Math.round(abs / 1000);
    unit = 's';
  } else if (abs < HOUR) {
    v = Math.round(abs / 60_000);
    unit = 'm';
  } else if (abs < DAY) {
    v = Math.round(abs / HOUR);
    unit = 'h';
  } else {
    v = Math.round(abs / DAY);
    unit = 'd';
  }
  return past ? `${v}${unit} ago` : `in ${v}${unit}`;
}

export function fmtCountdown(ms: number, now = Date.now()): string {
  const delta = ms - now;
  if (delta <= 0) return '00d 00h 00m 00s';
  const d = Math.floor(delta / DAY);
  const h = Math.floor((delta % DAY) / HOUR);
  const m = Math.floor((delta % HOUR) / 60_000);
  const s = Math.floor((delta % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

// Deterministic pseudo-random hex string (LCG) — for display fillers.
export function fakeHexBlock(seed: string, bytes: number): string {
  let s = 0;
  for (let i = 0; i < seed.length; i += 1) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  let out = '';
  for (let i = 0; i < bytes; i += 1) {
    s = (s * 1103515245 + 12345) >>> 0;
    out += ((s >>> 16) & 0xff).toString(16).padStart(2, '0');
  }
  return out;
}

export type PredictionStatus = 'sealed' | 'unlocked' | 'revealed';

export interface PredictionLike {
  unlockAtMs: number;
  revealed: boolean;
}

export function predictionStatus(
  p: PredictionLike,
  now = Date.now(),
): PredictionStatus {
  if (p.revealed) return 'revealed';
  if (now >= p.unlockAtMs) return 'unlocked';
  return 'sealed';
}
