import { Badge } from '@chakra-ui/react';

import type { ProgrammingLanguage } from '@/types';

import { LANGUAGE_COLOR_SCHEME, LANGUAGE_LABELS } from './languages';

export interface LanguageBadgeProps {
  language: ProgrammingLanguage;
}

export function LanguageBadge({ language }: LanguageBadgeProps) {
  return (
    <Badge colorScheme={LANGUAGE_COLOR_SCHEME[language]} variant="subtle" aria-label={`Language: ${LANGUAGE_LABELS[language]}`}>
      {LANGUAGE_LABELS[language]}
    </Badge>
  );
}

export default LanguageBadge;
