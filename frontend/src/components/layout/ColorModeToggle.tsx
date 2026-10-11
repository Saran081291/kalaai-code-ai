import { IconButton, useColorMode } from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';

import { MotionBox } from '@/components/ui/motion';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  return (
    <MotionBox whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9, rotate: 20 }}>
      <IconButton
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        icon={isDark ? <FiSun /> : <FiMoon />}
        variant="ghost"
        colorScheme="gray"
        borderRadius="full"
        onClick={toggleColorMode}
      />
    </MotionBox>
  );
}

export default ColorModeToggle;
