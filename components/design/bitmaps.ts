// Pixel-art bitmaps for TOLDPROOF. "X" = on, "." = off. Whitespace is stripped.
// Ported verbatim from docs/design/components.jsx so the brand stays identical.

export const BRAND_MARK = `
. . X X X X X . .
. X X X X X X X .
X X . . . . . X X
X X . . X . . X X
X X . X X X . X X
X X . . X . . X X
X X . . . . . X X
. X X X X X X X .
. . X X X X X . .
`;

export const STARBURST_MARK = `
. . . . X . . . .
. . . X X X . . .
. . . X X X . . .
X X . X X X . X X
X X X X X X X X X
X X . X X X . X X
. . . X X X . . .
. . . X X X . . .
. . . . X . . . .
`;

export const BIG_SEAL = `
X X X X X X X X X X X X X
X . . . . . . . . . . . X
X . X X X X X X X X X . X
X . . . . . . . . . . . X
X . X X X X X X X X X . X
X . . . . . . . . . . . X
X . X X X X X X X X X . X
X . . . . . . . . . . . X
X . . . . X X X . . . . X
X . . . X . X . X . . . X
X . . . X X X X X . . . X
X . . . . . . . . . . . X
X X X X X X X X X X X X X
`;

export const PIXEL_CHECK = `
. . . . X
. . . X X
X . X X .
X X X . .
. X . . .
`;

export const PIXEL_LOCK = `
. X X X .
X . . . X
X X X X X
X X X X X
X X X X X
`;

export const WALRUS_MARK = `
. . X X X X X . .
. X . X . X . X .
. X X X X X X X .
. X X . X . X X .
X X X X X X X X X
X X X . X . X X X
. X X X X X X X .
. X . X X X . X .
X . X . . . X . X
. . X . . . X . .
. . X . . . X . .
`;

export const SUI_MARK = `
. . . . X . . . .
. . . . X . . . .
. . . X X X . . .
. . . X X X . . .
. . X X X X X . .
. . X X X X X . .
. X X X X X X X .
. X X X X X X X .
. X X X X X X X .
. . X X X X X . .
. . . X X X . . .
`;

export const SEAL_KEY_MARK = `
. . . X X X . . .
. . X X X X X . .
. X . X . X . X .
. X X X X X X X .
. X X X X X X X .
X X X X X X X X X
X X X X X X X X X
X X X X X X X X X
. X X X X X X X .
X . X . . . X . X
X . . . . . . . X
`;

export const REP_BADGE = `
X . X . X . X . X . X
. X X X X X X X X X .
X X . . . . . . . X X
. X . . X X X . . X .
X X . X . . . X . X X
. X . X . X . X . X .
X X . X . . . X . X X
. X . . X X X . . X .
X X . . . . . . . X X
. X X X X X X X X X .
X . X . X . X . X . X
`;

// Alternate hero marks — for the Brand kit screen.
export const HERO_ALT_T_SEAL = `
. . . X X X X X . . .
. . X . . . . . X . .
. X . X X X X X . X .
X . . . . X . . . . X
X . . . . X . . . . X
X . . . . X . . . . X
X . . . . X . . . . X
X . . . . X . . . . X
. X . . . . . . . X .
. . X . . . . . X . .
. . . X X X X X . . .
`;

export const HERO_ALT_CROSS_SEAL = `
. . . X X X X X X X . . .
. . X . . . . . . . X . .
. X . X X X X X X X . X .
X . X . . . . . . . X . X
X . X . . . X . . . X . X
X . X . . . X . . . X . X
X . X X X X X X X X X . X
X . X . . . X . . . X . X
X . X . . . X . . . X . X
X . X . . . . . . . X . X
. X . X X X X X X X . X .
. . X . . . . . . . X . .
. . . X X X X X X X . . .
`;

export const HERO_ALT_BURST_SEAL = `
. . . X X X X X X X . . .
. . X . . . . . . . X . .
. X . . . . X . . . . X .
X . . . . X X X . . . . X
X . . . X X X X X . . . X
X . X X X X X X X X X . X
X . . . X X X X X . . . X
X . . . X X X X X . . . X
X . . . X X X X X . . . X
X . . . . . X . . . . . X
. X . . . . X . . . . X .
. . X . . . . . . . X . .
. . . X X X X X X X . . .
`;

export const HERO_ALT_SCROLL = BIG_SEAL;

// Alternate small marks — for the Brand kit screen.
export const ALT_C_DIAMOND = `
. . . . X . . . .
. . . X X X . . .
. . X X X X X . .
. X X X X X X X .
X X X X X X X X X
. X X X X X X X .
. . X X X X X . .
. . . X X X . . .
. . . . X . . . .
`;

export const ALT_D_TP_MONOGRAM = `
X X X X X . X X X
. . X . . . X . X
. . X . . . X X X
. . X . . . X . .
. . X . . . X . .
. . X . . . X . .
. . X . . . X . .
. . X . . . X . .
. . X . . . X . .
`;

export const ALT_E_ASTERISK = `
X . . . X . . . X
. X . . X . . X .
. . X . X . X . .
. . . X X X . . .
X X X X X X X X X
. . . X X X . . .
. . X . X . X . .
. X . . X . . X .
X . . . X . . . X
`;

export interface ParsedBitmap {
  w: number;
  h: number;
  cells: Array<[number, number]>;
}

export function parseBitmap(src: string): ParsedBitmap {
  const rows = src.trim().split('\n').map((r) => r.replace(/\s+/g, ''));
  const w = rows[0]?.length ?? 0;
  const h = rows.length;
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rows[y]?.[x] === 'X') cells.push([x, y]);
    }
  }
  return { w, h, cells };
}
