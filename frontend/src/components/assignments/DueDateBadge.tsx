import { Badge, HStack, Icon, Text, Tooltip } from '@chakra-ui/react';
import { FiClock } from 'react-icons/fi';

import type { ISODateString } from '@/types';

import { formatDateTime, formatRelative, isPast } from './dateUtils';

export interface DueDateBadgeProps {
  dueDate: ISODateString | null;
  /** Show the absolute date next to the relative one (default true). */
  showAbsolute?: boolean;
  size?: 'sm' | 'md';
}

/** "Due in 3 days · Tue, 14 Oct 2026, 11:59 pm" + a red "Late" badge once past due. */
export function DueDateBadge({ dueDate, showAbsolute = true, size = 'sm' }: DueDateBadgeProps) {
  if (!dueDate) {
    return (
      <HStack spacing={1.5} color="text.muted" fontSize={size}>
        <Icon as={FiClock} aria-hidden />
        <Text>No due date</Text>
      </HStack>
    );
  }

  const past = isPast(dueDate);
  const relative = formatRelative(dueDate);
  const absolute = formatDateTime(dueDate);

  return (
    <HStack spacing={1.5} fontSize={size} flexWrap="wrap" color={past ? 'red.500' : 'text.muted'}>
      <Icon as={FiClock} aria-hidden />
      <Tooltip label={absolute} hasArrow isDisabled={showAbsolute}>
        <Text as="span">
          {past ? 'Was due' : 'Due'} {relative}
        </Text>
      </Tooltip>
      {showAbsolute && (
        <Text as="span" color="text.muted">
          · <time dateTime={dueDate}>{absolute}</time>
        </Text>
      )}
      {past && (
        <Badge colorScheme="red" variant="solid" fontSize="0.7em">
          Late
        </Badge>
      )}
    </HStack>
  );
}

export default DueDateBadge;
