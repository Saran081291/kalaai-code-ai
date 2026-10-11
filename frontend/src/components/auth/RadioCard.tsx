import { Box, useRadio, type UseRadioProps } from '@chakra-ui/react';
import { useId, type ReactNode } from 'react';

export type RadioCardProps = UseRadioProps & {
  /** Accessible name of the option. */
  label: string;
  /** Accessible description (also usually rendered in `children`). */
  description?: string;
  children: ReactNode;
};

/**
 * Selectable card backed by a real (visually hidden) radio input, so arrow keys,
 * Tab and Space work like a native radio group. Use inside `useRadioGroup`.
 */
export function RadioCard({ label, description, children, ...radioProps }: RadioCardProps) {
  const { getInputProps, getRadioProps, state } = useRadio(radioProps);
  const descriptionId = useId();

  const input = getInputProps({
    'aria-label': label,
    'aria-describedby': description ? descriptionId : undefined,
  });
  const card = getRadioProps();

  return (
    <Box as="label" display="block" h="full" cursor={state.isDisabled ? 'not-allowed' : 'pointer'}>
      <input {...input} />
      <Box
        {...card}
        h="full"
        borderWidth="2px"
        borderRadius="xl"
        borderColor="border.subtle"
        bg="bg.surface"
        px={4}
        py={3}
        transitionProperty="common"
        transitionDuration="normal"
        opacity={state.isDisabled ? 0.6 : 1}
        _hover={state.isDisabled ? undefined : { borderColor: 'brand.300', boxShadow: 'md' }}
        _checked={{
          borderColor: 'accent.primary',
          bg: 'brand.50',
          boxShadow: 'md',
          _dark: { bg: 'whiteAlpha.100' },
        }}
        _focusVisible={{ boxShadow: 'outline' }}
      >
        {children}
      </Box>
      {description && (
        <Box id={descriptionId} srOnly>
          {description}
        </Box>
      )}
    </Box>
  );
}

export default RadioCard;
