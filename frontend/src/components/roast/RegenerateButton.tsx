import { Button, Menu, MenuButton, MenuDivider, MenuGroup, MenuItem, MenuList, Stack, Text } from '@chakra-ui/react';
import { FiChevronDown } from 'react-icons/fi';

import { MotionBox } from '@/components/ui/motion';
import { REGENERATE_LIMIT } from '@/hooks/useReview';
import { SPICE_META } from '@/lib/spice';
import { SPICE_LEVELS, type SpiceLevel } from '@/types';

export interface RegenerateButtonProps {
  regenerateCount: number;
  currentSpice: SpiceLevel;
  /** `spiceLevel` undefined → keep the current spice. */
  onRegenerate: (spiceLevel?: SpiceLevel) => void;
  isLoading?: boolean;
}

/** Owner student: "Innoru roast venum?" with an optional spice change. Max 2 regenerations. */
export function RegenerateButton({ regenerateCount, currentSpice, onRegenerate, isLoading = false }: RegenerateButtonProps) {
  const remaining = Math.max(0, REGENERATE_LIMIT - regenerateCount);
  const disabled = remaining === 0;

  return (
    <Stack spacing={1} align={{ base: 'stretch', sm: 'flex-start' }}>
      <Menu placement="bottom-start" isLazy>
        <MotionBox
          display="inline-block"
          whileHover={disabled ? undefined : { scale: 1.03, y: -2 }}
          whileTap={disabled ? undefined : { scale: 0.97 }}
        >
          <MenuButton
            as={Button}
            variant="brand"
            rightIcon={<FiChevronDown />}
            isDisabled={disabled}
            isLoading={isLoading}
            loadingText="Masala aragikkiren…"
            w={{ base: 'full', sm: 'auto' }}
          >
            Innoru roast venum? 🌶️
          </MenuButton>
        </MotionBox>
        <MenuList zIndex="dropdown">
          <MenuItem onClick={() => onRegenerate()}>Same spice ({SPICE_META[currentSpice].label})</MenuItem>
          <MenuDivider />
          <MenuGroup title="Change spice">
            {SPICE_LEVELS.filter((level) => level !== currentSpice).map((level) => (
              <MenuItem key={level} onClick={() => onRegenerate(level)}>
                {SPICE_META[level].emoji} {SPICE_META[level].label}
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuList>
      </Menu>
      <Text fontSize="sm" color="text.muted" data-testid="regenerate-remaining" aria-live="polite">
        {disabled
          ? 'Regenerate limit reached — idhu dhaan final roast!'
          : `${remaining} of ${REGENERATE_LIMIT} regenerations left`}
      </Text>
    </Stack>
  );
}

export default RegenerateButton;
