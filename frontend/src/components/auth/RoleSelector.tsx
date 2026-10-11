import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Icon,
  SimpleGrid,
  Text,
  VStack,
  useRadioGroup,
} from '@chakra-ui/react';
import type { IconType } from 'react-icons';
import { FiBookOpen, FiCode } from 'react-icons/fi';

import type { RegisterableRole } from '@/types';

import { RadioCard } from './RadioCard';

interface RoleOption {
  value: RegisterableRole;
  label: string;
  tagline: string;
  icon: IconType;
}

const ROLE_OPTIONS: readonly RoleOption[] = [
  { value: 'student', label: 'Student', tagline: 'Submit & get roasted', icon: FiCode },
  { value: 'instructor', label: 'Instructor', tagline: 'Create assignments & rubrics', icon: FiBookOpen },
];

function isRegisterableRole(value: string): value is RegisterableRole {
  return ROLE_OPTIONS.some((option) => option.value === value);
}

export interface RoleSelectorProps {
  value: RegisterableRole | null;
  onChange: (role: RegisterableRole) => void;
  error?: string;
  isDisabled?: boolean;
}

/** Student / Instructor selectable cards (keyboard-accessible radio group). */
export function RoleSelector({ value, onChange, error, isDisabled = false }: RoleSelectorProps) {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name: 'role',
    value: value ?? '',
    isDisabled,
    onChange: (next) => {
      if (isRegisterableRole(next)) onChange(next);
    },
  });

  return (
    <FormControl as="fieldset" isInvalid={Boolean(error)} isRequired>
      <FormLabel as="legend" fontWeight={600}>
        I am a…
      </FormLabel>
      <SimpleGrid {...getRootProps()} role="radiogroup" aria-label="Role" columns={{ base: 1, sm: 2 }} spacing={3}>
        {ROLE_OPTIONS.map((option) => (
          <RadioCard
            key={option.value}
            label={option.label}
            description={option.tagline}
            {...getRadioProps({ value: option.value })}
          >
            <HStack spacing={3} align="flex-start">
              <Icon as={option.icon} boxSize={6} color="accent.primary" mt={1} aria-hidden />
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight={700}>{option.label}</Text>
                <Text fontSize="sm" color="text.muted">
                  {option.tagline}
                </Text>
              </VStack>
            </HStack>
          </RadioCard>
        ))}
      </SimpleGrid>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  );
}

export default RoleSelector;
