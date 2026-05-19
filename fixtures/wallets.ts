// Worked-example fixtures for /docs/skill-score WorkedExample component.
// 17 resolved predictions covering the difficulty + age space, computed
// against the real lib/leaderboard constants so the example stays in sync
// with the math.

import type { DifficultyLevel } from '../lib/verdict-store';

export interface WorkedExampleRow {
  ageDays: number;
  difficulty: DifficultyLevel;
  hit: boolean;
}

/**
 * 17 rows · ~70% hit rate at trivial-and-easy, ~50% at medium-and-hard.
 * Spread across 12–540 days so recency decay produces a visible delta vs.
 * a naive no-decay score. The fixture is deliberately illustrative, not
 * tuned to produce a specific final score — render-time computation owns
 * the headline numbers.
 */
export const WORKED_EXAMPLE_FIXTURE: WorkedExampleRow[] = [
  { ageDays: 12, difficulty: 'hard', hit: true },
  { ageDays: 34, difficulty: 'medium', hit: true },
  { ageDays: 58, difficulty: 'medium', hit: false },
  { ageDays: 89, difficulty: 'easy', hit: true },
  { ageDays: 120, difficulty: 'hard', hit: true },
  { ageDays: 154, difficulty: 'medium', hit: true },
  { ageDays: 178, difficulty: 'easy', hit: true },
  { ageDays: 201, difficulty: 'medium', hit: false },
  { ageDays: 234, difficulty: 'hard', hit: false },
  { ageDays: 270, difficulty: 'medium', hit: true },
  { ageDays: 305, difficulty: 'easy', hit: true },
  { ageDays: 336, difficulty: 'medium', hit: false },
  { ageDays: 360, difficulty: 'easy', hit: false },
  { ageDays: 401, difficulty: 'medium', hit: true },
  { ageDays: 445, difficulty: 'hard', hit: true },
  { ageDays: 500, difficulty: 'easy', hit: false },
  { ageDays: 540, difficulty: 'medium', hit: false },
];
