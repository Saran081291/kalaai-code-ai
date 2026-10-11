import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  useDisclosure,
} from '@chakra-ui/react';
import { useRef } from 'react';
import { FiRotateCcw } from 'react-icons/fi';

import { MotionBox } from '@/components/ui/motion';

export interface ReReviewButtonProps {
  onConfirm: () => void;
  isLoading?: boolean;
}

/** Instructor: re-run the AI review (with confirmation). */
export function ReReviewButton({ onConfirm, isLoading = false }: ReReviewButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <MotionBox display="inline-block" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
        <Button variant="outline" colorScheme="maroon" leftIcon={<FiRotateCcw />} onClick={onOpen} isLoading={isLoading}>
          Re-run AI review
        </Button>
      </MotionBox>
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent bg="bg.surface" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight={700}>
              Re-run AI review?
            </AlertDialogHeader>
            <AlertDialogBody>
              Review and roast will be regenerated. The current score, any override, and the roast will be
              discarded.
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button ref={cancelRef} variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                Re-run review
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

export default ReReviewButton;
