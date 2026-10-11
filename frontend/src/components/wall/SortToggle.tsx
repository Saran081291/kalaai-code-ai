import { Button, ButtonGroup } from '@chakra-ui/react';

import { MotionBox } from '@/components/ui/motion';
import type { RoastWallSort } from '@/types';

export interface SortToggleProps {
  value: RoastWallSort;
  onChange: (sort: RoastWallSort) => void;
}

const OPTIONS: ReadonlyArray<{ value: RoastWallSort; label: string }> = [
  { value: 'recent', label: 'Recent' },
  { value: 'top', label: 'Top 🔥' },
];

/** Recent / Top toggle for the roast wall. */
export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <ButtonGroup size="sm" spacing={2} role="group" aria-label="Sort roasts">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <MotionBox key={option.value} display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant={selected ? 'brand' : 'outline'}
              colorScheme={selected ? 'brand' : 'gray'}
              borderRadius="full"
              aria-pressed={selected}
              onClick={() => {
                if (!selected) onChange(option.value);
              }}
            >
              {option.label}
            </Button>
          </MotionBox>
        );
      })}
    </ButtonGroup>
  );
}

export default SortToggle;
