import { PixelMark } from './PixelMark';
import { BIG_SEAL, STARBURST_MARK } from './bitmaps';

// Rotated pixel wax-seal — lands on the landing page with stamp-slam animation.
export function HeroStamp() {
  return (
    <div
      style={{
        position: 'relative',
        width: 220,
        height: 220,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        className="stamp-slam"
        style={{
          transform: 'rotate(-8deg)',
          padding: 18,
          border: '3px solid var(--ink)',
          borderRadius: 6,
          background: 'var(--paper)',
          boxShadow: '4px 4px 0 var(--ink)',
          display: 'grid',
          gap: 8,
          placeItems: 'center',
        }}
      >
        <PixelMark bitmap={BIG_SEAL} size={96} color="var(--ink)" />
        <div
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--ink)',
            textTransform: 'uppercase',
            textAlign: 'center',
            borderTop: '1px dashed var(--ink)',
            paddingTop: 6,
            width: '100%',
          }}
        >
          Toldproof · vol. I<br />
          sui · walrus · seal
        </div>
      </div>
      <div
        className="spark-pop"
        style={{ position: 'absolute', top: -2, right: 4, transform: 'rotate(12deg)' }}
      >
        <PixelMark bitmap={STARBURST_MARK} size={36} color="var(--sealed)" />
      </div>
    </div>
  );
}
