import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';

import { AnimatedInput } from '@/components/ui/AnimatedInput';
import { GradientButton } from '@/components/ui/GradientButton';
import type { CourseCreateRequest } from '@/types';

export const COURSE_NAME_MAX = 200;
export const COURSE_DESCRIPTION_MAX = 2000;

export interface CourseFormProps {
  initialValues?: { name?: string; description?: string | null };
  onSubmit: (values: CourseCreateRequest) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

/** Name + description form shared by "create course" and the "edit course" modal. */
export function CourseForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Create course',
  onCancel,
}: CourseFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [nameError, setNameError] = useState<string | undefined>();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Course name is required.');
      return;
    }
    if (trimmed.length > COURSE_NAME_MAX) {
      setNameError(`Course name must be at most ${COURSE_NAME_MAX} characters.`);
      return;
    }
    setNameError(undefined);
    const desc = description.trim();
    onSubmit({ name: trimmed, description: desc ? desc : null });
  };

  return (
    <VStack as="form" spacing={5} align="stretch" onSubmit={handleSubmit} noValidate>
      <AnimatedInput
        label="Course name"
        name="name"
        placeholder="e.g. Python Basics — Batch 7"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError}
        maxLength={COURSE_NAME_MAX}
        isRequired
        autoFocus
      />
      <FormControl isInvalid={description.length > COURSE_DESCRIPTION_MAX}>
        <FormLabel fontWeight={600}>Description</FormLabel>
        <Textarea
          name="description"
          placeholder="What will students learn? Any ground rules?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={COURSE_DESCRIPTION_MAX}
          bg="bg.surface"
          borderColor="border.subtle"
          borderRadius="xl"
        />
        <FormHelperText color="text.muted">Optional.</FormHelperText>
        <FormErrorMessage>Description is too long.</FormErrorMessage>
      </FormControl>
      <HStack justify="flex-end" spacing={3}>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <GradientButton type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </GradientButton>
      </HStack>
    </VStack>
  );
}

export default CourseForm;
