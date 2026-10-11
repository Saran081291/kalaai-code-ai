import { Flex, Spinner, Text } from '@chakra-ui/react';

import { MotionBox } from './motion';

export interface LoadingScreenProps {
  /** Fun Tanglish loading line. */
  text?: string;
  /** Fill the viewport (default) or just a section. */
  fullScreen?: boolean;
}

export function LoadingScreen({
  text = 'Konjam wait pannunga… masala ready aagudhu 🌶️',
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <Flex
      role="status"
      aria-live="polite"
      direction="column"
      align="center"
      justify="center"
      gap={4}
      minH={fullScreen ? '100vh' : '40vh'}
      w="full"
      px={4}
      textAlign="center"
    >
      <MotionBox
        fontSize="4xl"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, -8, 8, 0],
          transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
        }}
        aria-hidden
      >
        🔥
      </MotionBox>
      <Spinner size="md" thickness="3px" color="accent.primary" emptyColor="bg.muted" />
      <Text color="text.muted" fontWeight={500}>
        {text}
      </Text>
    </Flex>
  );
}

export default LoadingScreen;
