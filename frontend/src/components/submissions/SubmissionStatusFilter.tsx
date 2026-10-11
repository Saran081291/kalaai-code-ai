import { FormControl, FormLabel, Select } from '@chakra-ui/react';
import type { ChangeEvent } from 'react';

import { STATUS_META } from '@/lib/status';
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/types';

export type StatusFilterValue = SubmissionStatus | 'all';

export interface SubmissionStatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

function isStatusFilterValue(value: string): value is StatusFilterValue {
  return value === 'all' || (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

/** Status dropdown ("All statuses" + each SubmissionStatus). */
export function SubmissionStatusFilter({ value, onChange }: SubmissionStatusFilterProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (isStatusFilterValue(event.target.value)) onChange(event.target.value);
  };

  return (
    <FormControl maxW={{ base: 'full', sm: '220px' }}>
      <FormLabel htmlFor="submission-status-filter" fontSize="sm" mb={1} color="text.muted">
        Filter by status
      </FormLabel>
      <Select
        id="submission-status-filter"
        size="sm"
        borderRadius="lg"
        bg="bg.surface"
        value={value}
        onChange={handleChange}
      >
        <option value="all">All statuses</option>
        {SUBMISSION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_META[status].label}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}

export default SubmissionStatusFilter;
