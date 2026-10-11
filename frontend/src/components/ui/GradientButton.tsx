import { Button, type ButtonProps } from '@chakra-ui/react';
import { forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { MotionBox } from './motion';

export type GradientButtonProps = ButtonProps & {
  /** Render as a react-router link to this path. */
  to?: string;
  /** Stretch to the container width. */
  fullWidth?: boolean;
};

/** Primary CTA: temple-orange → maroon gradient pill with hover/tap motion. */
export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(function GradientButton(
  { to, fullWidth = false, isDisabled, isLoading, ...rest },
  ref,
) {
  const interactive = !isDisabled && !isLoading;
  const shared = {
    variant: 'brand',
    isDisabled,
    isLoading,
    w: fullWidth ? 'full' : undefined,
    ...rest,
  } satisfies ButtonProps;

  return (
    <MotionBox
      display={fullWidth ? 'block' : 'inline-block'}
      w={fullWidth ? 'full' : undefined}
      whileHover={interactive ? { scale: 1.03, y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.97 } : undefined}
    >
      {to ? <Button as={RouterLink} to={to} {...shared} /> : <Button ref={ref} {...shared} />}
    </MotionBox>
  );
});

export default GradientButton;
