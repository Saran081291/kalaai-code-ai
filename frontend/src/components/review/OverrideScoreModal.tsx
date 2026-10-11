import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';

import { GradientButton } from '@/components/ui/GradientButton';
import type { Review, ReviewOverrideRequest } from '@/types';

export interface OverrideScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: Review;
  maxScore: number;
  onSubmit: (body: ReviewOverrideRequest) => void;
  isSubmitting?: boolean;
}

/** Instructor: override (or clear) the AI score with a comment. */
export function OverrideScoreModal(props: OverrideScoreModalProps) {
  // Remount the form each time the modal opens so it starts from the current review values.
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} size={{ base: 'full', sm: 'md' }}>
      <ModalOverlay />
      {props.isOpen && <OverrideForm key={props.review.updatedAt} {...props} />}
    </Modal>
  );
}

function OverrideForm({ onClose, review, maxScore, onSubmit, isSubmitting = false }: OverrideScoreModalProps) {
  const [scoreText, setScoreText] = useState<string>(
    review.instructorOverrideScore !== null ? String(review.instructorOverrideScore) : '',
  );
  const [comment, setComment] = useState<string>(review.instructorComment ?? '');

  const trimmed = scoreText.trim();
  const parsed = trimmed === '' ? null : Number(trimmed);
  const error =
    parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > maxScore)
      ? `Score must be between 0 and ${maxScore}.`
      : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (error) return;
    onSubmit({ overrideScore: parsed, comment: comment.trim() ? comment.trim() : null });
  };

  return (
    <ModalContent as="form" onSubmit={handleSubmit} bg="bg.surface" borderRadius={{ base: 0, sm: '2xl' }}>
      <ModalHeader>Override score</ModalHeader>
      <ModalCloseButton aria-label="Close" />
      <ModalBody>
        <Stack spacing={4}>
          <Text color="text.muted" fontSize="sm">
            AI score: {review.totalScore} / {maxScore}. Leave the score empty to clear the override.
          </Text>
          <FormControl id="override-score" isInvalid={Boolean(error)}>
            <FormLabel>Override score</FormLabel>
            <NumberInput
              min={0}
              max={maxScore}
              value={scoreText}
              onChange={(value) => setScoreText(value)}
              keepWithinRange={false}
              clampValueOnBlur={false}
            >
              <NumberInputField placeholder={`0 – ${maxScore}`} />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            {error ? (
              <FormErrorMessage>{error}</FormErrorMessage>
            ) : (
              <FormHelperText color="text.muted">Between 0 and {maxScore}.</FormHelperText>
            )}
          </FormControl>
          <FormControl id="override-comment">
            <FormLabel>Comment for the student</FormLabel>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Why did you adjust the score?"
              maxLength={2000}
              rows={4}
            />
          </FormControl>
        </Stack>
      </ModalBody>
      <ModalFooter gap={3}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <GradientButton type="submit" isLoading={isSubmitting} isDisabled={Boolean(error)} loadingText="Saving">
          Save override
        </GradientButton>
      </ModalFooter>
    </ModalContent>
  );
}

export default OverrideScoreModal;
