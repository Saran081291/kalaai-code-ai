import { Box, chakra, Text, VisuallyHidden } from '@chakra-ui/react';
import { useReducedMotion, type Variants } from 'framer-motion';
import { useMemo } from 'react';

import { MotionBox, MotionSpan } from '@/components/ui/motion';
import type { Roast } from '@/types';

import { SpiceMeter } from './SpiceMeter';

export interface RoastRevealProps {
  roast: Roast;
}

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.25 } },
};

const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 1.1, staggerChildren: 0.025 } },
};

/** Dramatic roast reveal: flame burst → punchline → word-by-word roast. Respects reduced motion. */
export function RoastReveal({ roast }: RoastRevealProps) {
  const reduceMotion = useReducedMotion();
  const tokens = useMemo(() => roast.content.split(/(\s+)/).filter((token) => token.length > 0), [roast.content]);

  return (
    <Box position="relative" overflow="hidden" data-testid="roast-reveal">
      {!reduceMotion && (
        <MotionBox
          aria-hidden
          position="absolute"
          top="10%"
          left="50%"
          ml="-0.5em"
          fontSize="7xl"
          pointerEvents="none"
          zIndex={1}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: [0, 1.6, 2.6], opacity: [1, 1, 0], transition: { duration: 0.9, ease: 'easeOut' } }}
        >
          🔥
        </MotionBox>
      )}

      <Box mb={4}>
        <SpiceMeter level={roast.spiceLevel} />
      </Box>

      <MotionBox
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 20 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { delay: reduceMotion ? 0 : 0.5, type: 'spring', stiffness: 180, damping: 14 },
        }}
        mb={6}
      >
        <chakra.blockquote
          fontFamily="heading"
          fontWeight={800}
          fontSize={{ base: 'xl', md: '3xl' }}
          lineHeight="short"
          bgGradient="linear(to-r, brand.500, maroon.500)"
          bgClip="text"
          borderLeftWidth="4px"
          borderLeftColor="accent.primary"
          pl={4}
          data-testid="roast-punchline"
        >
          “{roast.punchline}”
        </chakra.blockquote>
      </MotionBox>

      {reduceMotion ? (
        <Text whiteSpace="pre-wrap" fontSize={{ base: 'md', md: 'lg' }} lineHeight="tall">
          {roast.content}
        </Text>
      ) : (
        <>
          <VisuallyHidden>{roast.content}</VisuallyHidden>
          <MotionBox
            aria-hidden
            whiteSpace="pre-wrap"
            fontSize={{ base: 'md', md: 'lg' }}
            lineHeight="tall"
            initial="hidden"
            animate="visible"
            variants={contentVariants}
          >
            {tokens.map((token, index) =>
              /^\s+$/.test(token) ? (
                token
              ) : (
                <MotionSpan key={index} display="inline-block" variants={wordVariants}>
                  {token}
                </MotionSpan>
              ),
            )}
          </MotionBox>
        </>
      )}
    </Box>
  );
}

export default RoastReveal;
