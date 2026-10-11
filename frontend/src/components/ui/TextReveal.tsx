import { Heading, type HeadingProps } from '@chakra-ui/react';
import type { Variants } from 'framer-motion';

import { MotionBox, MotionSpan } from './motion';

export type TextRevealProps = Omit<HeadingProps, 'children'> & {
  text: string;
  /** Delay between words in seconds. */
  stagger?: number;
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/** Headline that reveals word by word. */
export function TextReveal({ text, stagger = 0.06, ...headingProps }: TextRevealProps) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <MotionBox
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger } } }}
    >
      <Heading aria-label={text} {...headingProps}>
        {words.map((word, index) => (
          <MotionSpan key={`${word}-${index}`} display="inline-block" mr="0.25em" variants={wordVariants} aria-hidden>
            {word}
          </MotionSpan>
        ))}
      </Heading>
    </MotionBox>
  );
}

export default TextReveal;
