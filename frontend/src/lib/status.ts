import type { IssueSeverity, SubmissionStatus } from '@/types';

export interface StatusMeta {
  label: string;
  colorScheme: string;
  /** Fun Tanglish progress line shown while the pipeline runs. */
  funLine: string;
  inProgress: boolean;
}

export const STATUS_META: Record<SubmissionStatus, StatusMeta> = {
  pending: {
    label: 'Pending',
    colorScheme: 'gray',
    funLine: 'Queue-la wait panreenga… konjam porunga 🙏',
    inProgress: true,
  },
  fetching: {
    label: 'Fetching code',
    colorScheme: 'blue',
    funLine: 'Code-a download panren...',
    inProgress: true,
  },
  reviewing: {
    label: 'Reviewing',
    colorScheme: 'purple',
    funLine: 'Annae code-a padichitu irukkaru...',
    inProgress: true,
  },
  roasting: {
    label: 'Roasting',
    colorScheme: 'orange',
    funLine: 'Roast-ku masala ready panren 🌶️',
    inProgress: true,
  },
  completed: {
    label: 'Completed',
    colorScheme: 'green',
    funLine: 'Semma! Review ready 🔥',
    inProgress: false,
  },
  failed: {
    label: 'Failed',
    colorScheme: 'red',
    funLine: 'Aiyo, edho sothappitta! Retry pannunga.',
    inProgress: false,
  },
};

export const SEVERITY_COLOR_SCHEME: Record<IssueSeverity, string> = {
  critical: 'red',
  major: 'orange',
  minor: 'yellow',
  nit: 'gray',
};
