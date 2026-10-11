import { ISSUE_SEVERITIES, type IssueSeverity, type ReviewIssue, type SubmissionFile, type SubmissionStatus } from '@/types';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export interface PipelineStep {
  status: SubmissionStatus;
  title: string;
  description: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { status: 'fetching', title: 'Fetching code', description: 'Pulling your files from GitHub / uploads' },
  { status: 'reviewing', title: 'AI review', description: 'Scoring against the rubric' },
  { status: 'roasting', title: 'Madurai roast', description: 'Cooking up the kalaai' },
  { status: 'completed', title: 'Ready', description: 'Review + roast served' },
];

/** Index of the step that is currently running (`pending` counts as the first step). */
export function activeStepIndex(status: SubmissionStatus): number {
  if (status === 'pending') return 0;
  const index = PIPELINE_STEPS.findIndex((step) => step.status === status);
  return index === -1 ? 0 : index;
}

/** Most severe first. */
export function sortIssues(issues: ReviewIssue[]): ReviewIssue[] {
  const rank = (severity: IssueSeverity) => ISSUE_SEVERITIES.indexOf(severity);
  return [...issues].sort((a, b) => rank(a.severity) - rank(b.severity));
}

/** Location of a line in a submitted file (from a clicked issue). */
export interface CodeTarget {
  file: string;
  line: number | null;
}

function normalisePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
}

/** Find the submitted file an issue refers to (exact path, then suffix match, then basename). */
export function findFile(files: SubmissionFile[], wanted: string | undefined): SubmissionFile | undefined {
  if (!wanted) return undefined;
  const target = normalisePath(wanted);
  const normalised = files.map((file) => ({ file, path: normalisePath(file.path) }));
  return (
    normalised.find((entry) => entry.path === target)?.file ??
    normalised.find((entry) => entry.path.endsWith(`/${target}`) || target.endsWith(`/${entry.path}`))?.file ??
    normalised.find((entry) => entry.path.split('/').pop() === target.split('/').pop())?.file
  );
}

/** Max number of code lines rendered at once (large files are windowed around the target line). */
export const MAX_RENDERED_LINES = 2000;

export interface LineWindow {
  /** 0-based index of the first rendered line. */
  start: number;
  /** 0-based exclusive end. */
  end: number;
  total: number;
  truncated: boolean;
}

/** Which slice of a file to render, centred on `targetLine` (1-based) when the file is too long. */
export function getLineWindow(total: number, targetLine: number | null, max: number = MAX_RENDERED_LINES): LineWindow {
  if (total <= max) return { start: 0, end: total, total, truncated: false };
  const centre = targetLine && targetLine > 0 ? targetLine - 1 : 0;
  const start = Math.max(0, Math.min(centre - Math.floor(max / 2), total - max));
  return { start, end: start + max, total, truncated: true };
}
