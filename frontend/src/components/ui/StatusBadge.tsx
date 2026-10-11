import { Badge, type BadgeProps, Spinner } from '@chakra-ui/react';

import { STATUS_META } from '@/lib/status';
import type { SubmissionStatus } from '@/types';

export interface StatusBadgeProps {
  status: SubmissionStatus;
  size?: BadgeProps['fontSize'];
}

/** SubmissionStatus → colored badge (spinner while the pipeline is running). */
export function StatusBadge({ status, size = 'xs' }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <Badge
      colorScheme={meta.colorScheme}
      variant="subtle"
      fontSize={size}
      display="inline-flex"
      alignItems="center"
      gap={1.5}
      px={2}
      py={0.5}
      borderRadius="full"
      data-status={status}
    >
      {meta.inProgress && status !== 'pending' && <Spinner size="xs" thickness="2px" />}
      {meta.label}
    </Badge>
  );
}

export default StatusBadge;
