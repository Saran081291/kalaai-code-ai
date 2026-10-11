import { Tag, TagLabel, type TagProps } from '@chakra-ui/react';

import { SPICE_META } from '@/lib/spice';
import type { SpiceLevel } from '@/types';

export interface SpiceChipProps {
  level: SpiceLevel;
  size?: TagProps['size'];
  /** Hide the text label and show only chilies. */
  chiliesOnly?: boolean;
}

/** 🌶️ x1/x2/x3 + "Mild" / "Medium" / "Madurai Mass". */
export function SpiceChip({ level, size = 'md', chiliesOnly = false }: SpiceChipProps) {
  const meta = SPICE_META[level];
  return (
    <Tag
      size={size}
      colorScheme={meta.colorScheme}
      variant="subtle"
      borderRadius="full"
      aria-label={`Spice level: ${meta.label}`}
      title={meta.tagline}
      data-spice={level}
    >
      <TagLabel display="flex" alignItems="center" gap={1}>
        <span aria-hidden>{meta.emoji}</span>
        {!chiliesOnly && <span>{meta.label}</span>}
      </TagLabel>
    </Tag>
  );
}

export default SpiceChip;
