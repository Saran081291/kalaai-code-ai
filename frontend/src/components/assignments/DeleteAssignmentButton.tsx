import { Button, useDisclosure, useToast } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';

import { ConfirmDialog } from '@/components/courses/ConfirmDialog';
import { useDeleteAssignment } from '@/hooks/useAssignments';
import type { Assignment } from '@/types';

import { assignmentErrorMessage } from './errors';

export interface DeleteAssignmentButtonProps {
  assignment: Assignment;
  onDeleted: () => void;
}

/** Delete with AlertDialog confirmation; surfaces HAS_SUBMISSIONS clearly. */
export function DeleteAssignmentButton({ assignment, onDeleted }: DeleteAssignmentButtonProps) {
  const toast = useToast();
  const confirm = useDisclosure();
  const remove = useDeleteAssignment(assignment.id, assignment.courseId);

  const handleConfirm = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        confirm.onClose();
        toast({ status: 'success', title: 'Assignment delete aachu 🗑️' });
        onDeleted();
      },
      onError: (err) => {
        confirm.onClose();
        toast({ status: 'error', title: "Couldn't delete the assignment", description: assignmentErrorMessage(err) });
      },
    });
  };

  return (
    <>
      <Button variant="outline" colorScheme="red" leftIcon={<FiTrash2 />} onClick={confirm.onOpen}>
        Delete
      </Button>
      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={confirm.onClose}
        onConfirm={handleConfirm}
        title="Delete this assignment?"
        body={`"${assignment.title}" and its rubric will be removed permanently. Assignments with submissions can't be deleted.`}
        confirmLabel="Delete"
        isLoading={remove.isPending}
      />
    </>
  );
}

export default DeleteAssignmentButton;
