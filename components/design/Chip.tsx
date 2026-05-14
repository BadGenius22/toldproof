import type { ReactNode } from 'react';
import { fmtRel, predictionStatus, type PredictionLike } from './format';

type ChipStatus = 'sealed' | 'verified' | 'warn' | 'neutral';

interface ChipProps {
  status: ChipStatus;
  children: ReactNode;
}

export function Chip({ status, children }: ChipProps) {
  return (
    <span className={`chip ${status}`}>
      <span className="led"></span>
      {children}
    </span>
  );
}

interface StatusChipProps {
  p: PredictionLike;
  now?: number;
}

export function StatusChip({ p, now = Date.now() }: StatusChipProps) {
  const s = predictionStatus(p, now);
  if (s === 'revealed') return <Chip status="verified">Opened</Chip>;
  if (s === 'unlocked')
    return <Chip status="warn">Ready to open · posting soon</Chip>;
  return (
    <Chip status="sealed">
      Locked · {fmtRel(p.unlockAtMs, now).replace('in ', '')} left
    </Chip>
  );
}
