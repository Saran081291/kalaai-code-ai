import { MotionBox, type MotionBoxProps } from './motion';

export type GlassCardProps = MotionBoxProps & {
  /** Lift + glow on hover (default true). */
  hoverable?: boolean;
};

/** Frosted-glass card with enter animation and hover elevation. */
export function GlassCard({ children, hoverable = true, ...rest }: GlassCardProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
      whileHover={hoverable ? { y: -4, scale: 1.01 } : undefined}
      bg="bg.glass"
      backdropFilter="blur(14px)"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="2xl"
      boxShadow="lg"
      p={6}
      _hover={hoverable ? { boxShadow: 'xl', borderColor: 'brand.300' } : undefined}
      {...rest}
    >
      {children}
    </MotionBox>
  );
}

export default GlassCard;
