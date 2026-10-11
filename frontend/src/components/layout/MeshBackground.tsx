import { Box } from '@chakra-ui/react';

import { MotionBox } from '@/components/ui/motion';

interface BlobProps {
  color: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  duration: number;
}

function Blob({ color, duration, ...position }: BlobProps) {
  return (
    <MotionBox
      position="absolute"
      boxSize={{ base: '18rem', md: '26rem' }}
      borderRadius="full"
      bg={color}
      filter="blur(90px)"
      opacity={0.35}
      _dark={{ opacity: 0.18 }}
      animate={{
        scale: [1, 1.15, 1],
        x: [0, 30, 0],
        y: [0, -20, 0],
        transition: { duration, repeat: Infinity, ease: 'easeInOut' },
      }}
      {...position}
    />
  );
}

/** Animated warm gradient mesh for landing/auth/public pages. Render inside a `position: relative; isolation: isolate` parent. */
export function MeshBackground() {
  return (
    <Box position="fixed" inset={0} zIndex={-1} overflow="hidden" pointerEvents="none" aria-hidden>
      <Box
        position="absolute"
        inset={0}
        bgGradient="linear(to-br, jasmine.50, jasmine.100, brand.50)"
        _dark={{ bgGradient: 'linear(to-br, #16100D, #211814, #2B1418)' }}
      />
      <Blob color="brand.300" top="-6rem" left="10%" duration={12} />
      <Blob color="maroon.300" bottom="-8rem" right="8%" duration={14} />
      <Blob color="jasmine.400" top="35%" left="55%" duration={16} />
    </Box>
  );
}

export default MeshBackground;
