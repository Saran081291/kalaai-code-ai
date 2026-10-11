import { FormControl, FormErrorMessage, FormHelperText, FormLabel, Input } from '@chakra-ui/react';
import type { ChangeEvent } from 'react';

import { JOIN_CODE_LENGTH, normalizeJoinCode } from './joinCode';

export interface JoinCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  isDisabled?: boolean;
}

/** 8-character join code field: uppercases as you type and strips anything non-alphanumeric. */
export function JoinCodeInput({ value, onChange, error, isDisabled }: JoinCodeInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(normalizeJoinCode(event.target.value));
  };

  return (
    <FormControl isInvalid={Boolean(error)} isRequired>
      <FormLabel fontWeight={600}>Join code</FormLabel>
      <Input
        name="joinCode"
        value={value}
        onChange={handleChange}
        isDisabled={isDisabled}
        placeholder="ABCD1234"
        maxLength={JOIN_CODE_LENGTH}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        size="lg"
        h={16}
        textAlign="center"
        fontFamily="mono"
        fontSize={{ base: '2xl', md: '3xl' }}
        fontWeight={700}
        letterSpacing={{ base: '0.25em', md: '0.4em' }}
        textTransform="uppercase"
        bg="bg.surface"
        borderColor="border.subtle"
        borderRadius="xl"
      />
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : (
        <FormHelperText color="text.muted">
          {JOIN_CODE_LENGTH} letters/numbers — your instructor will share it.
        </FormHelperText>
      )}
    </FormControl>
  );
}

export default JoinCodeInput;
