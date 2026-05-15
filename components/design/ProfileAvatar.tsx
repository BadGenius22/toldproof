// Profile avatar — humans show their X avatar, agents show a deterministic
// 8x8 pixel identicon seeded from the wallet address so each agent has a
// stable visual identity without needing an off-chain image upload.

// eslint-disable-next-line @next/next/no-img-element -- avatars come from
// X's CDN, which our next/image domain config does not whitelist by default
// for hackathon scope. Plain <img> avoids the SSR cycle that <Image> needs.

type EntityType = 0 | 1; // 0 = human, 1 = agent (matches lib/sui ENTITY_*)

interface ProfileAvatarProps {
  handle: string;
  avatarUrl?: string | null;
  entityType: EntityType;
  publisher?: string;
  size?: number;
  verified?: boolean;
}

export function ProfileAvatar({
  handle,
  avatarUrl,
  entityType,
  publisher,
  size = 78,
  verified = false,
}: ProfileAvatarProps) {
  const isAgent = entityType === 1;

  // Humans with a bound X avatar → render the actual photo.
  if (!isAgent && avatarUrl) {
    return (
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--paper-2)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={`@${handle}`}
          width={size}
          height={size}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {verified && <VerifiedStamp />}
      </div>
    );
  }

  // Agents → deterministic 8x8 pixel identicon based on the publisher addr.
  // Falls back to the handle if no publisher (shouldn't happen in practice).
  if (isAgent) {
    return (
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 4,
          background: 'var(--paper)',
          border: '1px solid var(--ink)',
          display: 'grid',
          placeItems: 'center',
          padding: 6,
        }}
      >
        <Identicon seed={publisher ?? handle} size={size - 12} />
      </div>
    );
  }

  // Human without a bound avatar → initial-letter fallback (same look as v1
  // so existing profiles don't visually regress).
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        background: 'var(--ink)',
        color: 'var(--paper)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: Math.round(size * 0.46),
        fontWeight: 600,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      {handle.slice(0, 1).toUpperCase()}
      {verified && <VerifiedStamp />}
    </div>
  );
}

function VerifiedStamp() {
  return (
    <span
      title="X account verified"
      style={{
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 22,
        height: 22,
        background: 'var(--verified)',
        color: 'var(--paper)',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 12,
        fontWeight: 700,
        border: '2px solid var(--paper)',
      }}
    >
      ✓
    </span>
  );
}

// Deterministic 8x8 mirrored grid — same algorithm as classic GitHub identicons.
// We don't need a crypto-strength hash; the seed → bit pattern just needs to
// be stable. FNV-1a is fine and small.
function Identicon({ seed, size }: { seed: string; size: number }) {
  const cells = identiconBits(seed);
  const color = identiconColor(seed);
  const cellSize = size / 8;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`avatar:${seed.slice(0, 8)}`}
      style={{ display: 'block' }}
    >
      {cells.map(([x, y], i) => (
        <rect
          key={i}
          x={x * cellSize}
          y={y * cellSize}
          width={cellSize + 0.4}
          height={cellSize + 0.4}
          fill={color}
        />
      ))}
    </svg>
  );
}

function identiconBits(seed: string): Array<[number, number]> {
  const hash = fnv1a(seed);
  const out: Array<[number, number]> = [];
  // 4 columns of 8 rows; mirror to right half. 32 bits total.
  let bits = hash;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const on = (bits & 1) === 1;
      bits = bits >>> 1;
      if (on) {
        out.push([x, y]);
        if (x < 3) out.push([7 - x, y]);
      }
    }
  }
  return out;
}

function identiconColor(seed: string): string {
  const hash = fnv1a(seed + '#color');
  const hue = hash % 360;
  return `oklch(0.55 0.14 ${hue})`;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
