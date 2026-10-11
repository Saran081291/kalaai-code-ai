import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react';
import { useRef, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Chakra colorScheme for the confirm button (default red = destructive). */
  confirmColorScheme?: string;
  isLoading?: boolean;
}

/** Chakra AlertDialog wrapper used for destructive / irreversible actions (never window.confirm). */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColorScheme = 'red',
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent bg="bg.surface" borderRadius="2xl" mx={4}>
          <AlertDialogHeader fontSize="lg" fontWeight={700}>
            {title}
          </AlertDialogHeader>
          <AlertDialogBody color="text.muted">{body}</AlertDialogBody>
          <AlertDialogFooter gap={3}>
            <Button ref={cancelRef} variant="ghost" onClick={onClose} isDisabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button colorScheme={confirmColorScheme} onClick={onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export default ConfirmDialog;
