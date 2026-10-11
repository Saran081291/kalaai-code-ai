import type { RubricCriterion, RubricCriterionInput } from '@/types';

export const CRITERION_NAME_MAX = 100;

/** Editable rubric row. `maxPoints` is kept as the raw input string. */
export interface RubricCriterionDraft {
  /** Stable React key (not sent to the API). */
  key: string;
  name: string;
  description: string;
  maxPoints: string;
}

let keySeq = 0;
export function newCriterionKey(): string {
  keySeq += 1;
  return `criterion-${Date.now().toString(36)}-${keySeq}`;
}

export function emptyCriterion(): RubricCriterionDraft {
  return { key: newCriterionKey(), name: '', description: '', maxPoints: '' };
}

export function criteriaToDrafts(criteria: RubricCriterion[] | undefined): RubricCriterionDraft[] {
  return [...(criteria ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ key: `saved-${c.id}`, name: c.name, description: c.description, maxPoints: String(c.maxPoints) }));
}

export function parsePoints(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function rubricTotal(criteria: Array<{ maxPoints: string | number }>): number {
  return criteria.reduce(
    (sum, c) => sum + (typeof c.maxPoints === 'number' ? c.maxPoints : parsePoints(c.maxPoints)),
    0,
  );
}

/** Drafts → API payload with 0-based positions in display order. */
export function draftsToInput(drafts: RubricCriterionDraft[]): RubricCriterionInput[] {
  return drafts.map((d, index) => ({
    name: d.name.trim(),
    description: d.description.trim(),
    maxPoints: parsePoints(d.maxPoints),
    position: index,
  }));
}

/** First validation problem with the rubric rows, or null. Does not check the total. */
export function validateCriteria(drafts: RubricCriterionDraft[]): string | null {
  for (const [index, d] of drafts.entries()) {
    const label = `Criterion ${index + 1}`;
    if (!d.name.trim()) return `${label}: name is required.`;
    if (d.name.trim().length > CRITERION_NAME_MAX) return `${label}: name must be at most ${CRITERION_NAME_MAX} characters.`;
    const points = Number(d.maxPoints);
    if (!d.maxPoints.trim() || !Number.isInteger(points) || points <= 0) {
      return `${label}: points must be a whole number greater than 0.`;
    }
  }
  return null;
}

/** Split `maxScore` evenly across rows (remainder goes to the first rows). */
export function autoBalance(drafts: RubricCriterionDraft[], maxScore: number): RubricCriterionDraft[] {
  if (drafts.length === 0 || maxScore <= 0) return drafts;
  const base = Math.floor(maxScore / drafts.length);
  const remainder = maxScore % drafts.length;
  return drafts.map((d, index) => ({ ...d, maxPoints: String(base + (index < remainder ? 1 : 0)) }));
}
