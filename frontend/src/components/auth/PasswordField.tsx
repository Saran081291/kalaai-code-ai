import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  type InputProps,
} from '@chakra-ui/react';
import { forwardRef, useState, type FocusEvent, type ReactNode } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

import { MotionBox } from '@/components/ui/motion';

export type PasswordFieldProps = Omit<InputProps, 'type'> & {
  label: string;
  error?: string;
  helperText?: string;
  /** Extra content under the input (e.g. a strength meter). */
  footer?: ReactNode;
};

/** AnimatedInput-style password field with a show/hide toggle. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, helperText, footer, isRequired, id, onFocus, onBlur, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
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
      <FormLabel fontWeight={600}>{label}</FormLabel>
      <MotionBox animate={{ scale: focused ? 1.01 : 1, transition: { duration: 0.15 } }}>
        <InputGroup size="lg">
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            borderRadius="xl"
            bg="bg.surface"
            borderColor="border.subtle"
            pr="3.5rem"
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...rest}
          />
          <InputRightElement width="3.5rem">
            <IconButton
              aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              icon={visible ? <FiEyeOff /> : <FiEye />}
              size="sm"
              variant="ghost"
              borderRadius="full"
              onClick={() => setVisible((v) => !v)}
            />
          </InputRightElement>
        </InputGroup>
      </MotionBox>
      {footer}
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : (
        helperText && <FormHelperText color="text.muted">{helperText}</FormHelperText>
      )}
    </FormControl>
  );
});

export default PasswordField;
