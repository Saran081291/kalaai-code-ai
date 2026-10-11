import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Switch,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';

import { AnimatedInput } from '@/components/ui/AnimatedInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { PROGRAMMING_LANGUAGES, type Assignment, type AssignmentCreateRequest, type ProgrammingLanguage } from '@/types';

import { fromDateTimeLocal, toDateTimeLocal } from './dateUtils';
import { LANGUAGE_LABELS } from './languages';
import { draftsToInput, rubricTotal, validateCriteria, type RubricCriterionDraft } from './rubric';
import { RubricBuilder } from './RubricBuilder';

export const TITLE_MAX = 200;
export const MAX_SCORE_LIMIT = 1000;
export const MAX_ATTEMPTS_LIMIT = 50;

interface FormValues {
  title: string;
  description: string;
  language: ProgrammingLanguage;
  /** `datetime-local` value (local time) or ''. */
  dueDate: string;
  maxScore: string;
  maxAttempts: string;
  allowLate: boolean;
}

type FieldErrors = Partial<Record<keyof FormValues | 'rubric', string>>;

export interface AssignmentFormProps {
  /** Prefill from an existing assignment (edit mode). */
  initialAssignment?: Assignment;
  /** Render the RubricBuilder and include `rubricCriteria` in the payload (create mode). */
  withRubric?: boolean;
  /** Called with a validated payload (`rubricCriteria` only when `withRubric`). */
  onSubmit: (payload: AssignmentCreateRequest) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  /** Error from the last API call, shown above the submit button. */
  serverError?: string | null;
}

function initialValues(a: Assignment | undefined): FormValues {
  return {
    title: a?.title ?? '',
    description: a?.description ?? '',
    language: a?.language ?? 'python',
    dueDate: toDateTimeLocal(a?.dueDate),
    maxScore: String(a?.maxScore ?? 100),
    maxAttempts: String(a?.maxAttempts ?? 3),
    allowLate: a?.allowLate ?? false,
  };
}

function parseIntInRange(value: string, min: number, max: number): number | null {
  const n = Number(value);
  if (!value.trim() || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** Assignment details (+ optional rubric) form. Produces an `AssignmentCreateRequest`. */
export function AssignmentForm({
  initialAssignment,
  withRubric = false,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Create assignment',
  onCancel,
  serverError,
}: AssignmentFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(initialAssignment));
  const [criteria, setCriteria] = useState<RubricCriterionDraft[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const liveMaxScore = parseIntInRange(values.maxScore, 1, MAX_SCORE_LIMIT) ?? 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: FieldErrors = {};

    const title = values.title.trim();
    if (!title) next.title = 'Title is required.';
    else if (title.length > TITLE_MAX) next.title = `Title must be at most ${TITLE_MAX} characters.`;

    const description = values.description.trim();
    if (!description) next.description = 'Description is required — tell students what to build.';

    const maxScore = parseIntInRange(values.maxScore, 1, MAX_SCORE_LIMIT);
    if (maxScore === null) next.maxScore = `Max score must be a whole number between 1 and ${MAX_SCORE_LIMIT}.`;

    const maxAttempts = parseIntInRange(values.maxAttempts, 1, MAX_ATTEMPTS_LIMIT);
    if (maxAttempts === null) next.maxAttempts = `Attempts must be a whole number between 1 and ${MAX_ATTEMPTS_LIMIT}.`;

    const dueDate = fromDateTimeLocal(values.dueDate);
    if (values.dueDate && dueDate === null) next.dueDate = 'Enter a valid date and time.';

    if (withRubric && criteria.length > 0) {
      const rubricError = validateCriteria(criteria);
      if (rubricError) next.rubric = rubricError;
      else if (maxScore !== null && rubricTotal(criteria) !== maxScore) {
        next.rubric = `Rubric total (${rubricTotal(criteria)}) must equal the max score (${maxScore}). Remove all criteria to save a draft without a rubric.`;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || maxScore === null || maxAttempts === null) return;

    const payload: AssignmentCreateRequest = {
      title,
      description,
      language: values.language,
      dueDate,
      maxScore,
      maxAttempts,
      allowLate: values.allowLate,
    };
    if (withRubric) payload.rubricCriteria = draftsToInput(criteria);
    onSubmit(payload);
  };

  return (
    <VStack as="form" align="stretch" spacing={6} onSubmit={handleSubmit} noValidate aria-label="Assignment form">
      <AnimatedInput
        label="Title"
        name="title"
        placeholder="e.g. FizzBuzz, but make it clean"
        value={values.title}
        onChange={(e) => set('title', e.target.value)}
        error={errors.title}
        maxLength={TITLE_MAX}
        isRequired
      />

      <FormControl isRequired isInvalid={Boolean(errors.description)}>
        <FormLabel fontWeight={600}>Description</FormLabel>
        <Textarea
          name="description"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={'## Task\nWrite a function that…\n\n## Requirements\n- …'}
          rows={8}
          fontFamily="mono"
          fontSize="sm"
          bg="bg.surface"
          borderColor="border.subtle"
          borderRadius="xl"
        />
        {errors.description ? (
          <FormErrorMessage>{errors.description}</FormErrorMessage>
        ) : (
          <FormHelperText color="text.muted">Markdown text is fine — it's shown to students as written.</FormHelperText>
        )}
      </FormControl>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
        <FormControl isRequired>
          <FormLabel fontWeight={600}>Language</FormLabel>
          <Select
            name="language"
            value={values.language}
            onChange={(e) => set('language', e.target.value as ProgrammingLanguage)}
            size="lg"
            borderRadius="xl"
            bg="bg.surface"
            borderColor="border.subtle"
          >
            {PROGRAMMING_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </Select>
        </FormControl>

        <AnimatedInput
          label="Due date"
          name="dueDate"
          type="datetime-local"
          value={values.dueDate}
          onChange={(e) => set('dueDate', e.target.value)}
          error={errors.dueDate}
          helperText="Optional. Your local time."
        />

        <AnimatedInput
          label="Max score"
          name="maxScore"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SCORE_LIMIT}
          value={values.maxScore}
          onChange={(e) => set('maxScore', e.target.value)}
          error={errors.maxScore}
          isRequired
        />

        <AnimatedInput
          label="Max attempts"
          name="maxAttempts"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_ATTEMPTS_LIMIT}
          value={values.maxAttempts}
          onChange={(e) => set('maxAttempts', e.target.value)}
          error={errors.maxAttempts}
          isRequired
        />
      </SimpleGrid>

      <FormControl display="flex" alignItems="center" gap={3}>
        <Switch
          id="allowLate"
          isChecked={values.allowLate}
          onChange={(e) => set('allowLate', e.target.checked)}
        />
        <FormLabel htmlFor="allowLate" mb={0} fontWeight={600}>
          Allow late submissions
        </FormLabel>
      </FormControl>

      {withRubric && (
        <VStack align="stretch" spacing={3}>
          <Divider borderColor="border.subtle" />
          <Heading size="md">Rubric</Heading>
          <Text color="text.muted" fontSize="sm">
            Optional now, required to publish. Points must add up to the max score.
          </Text>
          <RubricBuilder criteria={criteria} onChange={setCriteria} maxScore={liveMaxScore} isDisabled={isSubmitting} />
          {errors.rubric && (
            <Alert status="warning" borderRadius="xl">
              <AlertIcon />
              <AlertDescription>{errors.rubric}</AlertDescription>
            </Alert>
          )}
        </VStack>
      )}

      {serverError && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

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

export default AssignmentForm;
