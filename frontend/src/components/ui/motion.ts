import { chakra, shouldForwardProp } from '@chakra-ui/react';
import { isValidMotionProp, motion } from 'framer-motion';
import type { ComponentProps } from 'react';

const forwardMotionAndChakraProps = (prop: string): boolean =>
  isValidMotionProp(prop) || shouldForwardProp(prop);

/**
 * Chakra Box that also accepts Framer Motion props (initial, animate, whileHover, variants…).
 * NOTE: Chakra's `transition` (CSS) prop wins over Framer's — put motion transitions inside
 * `animate={{ ..., transition: {...} }}` or inside `variants`.
 */
export const MotionBox = chakra(motion.div, { shouldForwardProp: forwardMotionAndChakraProps });
export type MotionBoxProps = ComponentProps<typeof MotionBox>;

/** Inline variant (for word-by-word text animations). */
export const MotionSpan = chakra(motion.span, { shouldForwardProp: forwardMotionAndChakraProps });
export type MotionSpanProps = ComponentProps<typeof MotionSpan>;
