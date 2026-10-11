import { SimpleGrid, type SimpleGridProps } from '@chakra-ui/react';
import type { Variants } from 'framer-motion';
import { Children, isValidElement, type ReactNode } from 'react';

import { MotionBox } from './motion';

export interface AnimatedListProps {
  children: ReactNode;
  /** Grid columns (responsive). Defaults to a single column list. */
  columns?: SimpleGridProps['columns'];
  spacing?: SimpleGridProps['spacing'];
  /** Delay between items in seconds. */
  stagger?: number;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/** Staggered fade-in list/grid. Give children stable `key`s. */
export function AnimatedList({ children, columns = 1, spacing = 4, stagger = 0.08 }: AnimatedListProps) {
  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger } },
  };

  return (
    <MotionBox initial="hidden" animate="visible" variants={containerVariants}>
      <SimpleGrid columns={columns} spacing={spacing}>
        {Children.toArray(children).map((child, index) => (
          <MotionBox key={isValidElement(child) && child.key !== null ? child.key : index} variants={itemVariants}>
            {child}
          </MotionBox>
        ))}
      </SimpleGrid>
    </MotionBox>
  );
}

export default AnimatedList;
