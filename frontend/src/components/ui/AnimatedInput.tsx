import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  type InputProps,
} from '@chakra-ui/react';
import { forwardRef, useState, type FocusEvent } from 'react';

import { MotionBox } from './motion';

export type AnimatedInputProps = InputProps & {
  label?: string;
  error?: string;
  helperText?: string;
};

/** Labelled input with a subtle focus "pop" and inline validation message. */
export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(function AnimatedInput(
  { label, error, helperText, isRequired, id, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <FormControl id={id} isInvalid={Boolean(error)} isRequired={isRequired}>
      {label && <FormLabel fontWeight={600}>{label}</FormLabel>}
      <MotionBox animate={{ scale: focused ? 1.01 : 1, transition: { duration: 0.15 } }}>
        <Input
          ref={ref}
          size="lg"
          borderRadius="xl"
          bg="bg.surface"
          borderColor="border.subtle"
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
      </MotionBox>
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : (
        helperText && <FormHelperText color="text.muted">{helperText}</FormHelperText>
      )}
    </FormControl>
  );
});

export default AnimatedInput;
