import type { ProgrammingLanguage } from '@/types';

export const LANGUAGE_LABELS: Record<ProgrammingLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  other: 'Other',
};

export const LANGUAGE_COLOR_SCHEME: Record<ProgrammingLanguage, string> = {
  python: 'blue',
  javascript: 'yellow',
  typescript: 'cyan',
  java: 'orange',
  c: 'gray',
  cpp: 'purple',
  other: 'gray',
};
