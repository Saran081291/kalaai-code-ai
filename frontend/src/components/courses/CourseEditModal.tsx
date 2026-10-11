import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';

import { useUpdateCourse } from '@/hooks/useCourses';
import { getErrorMessage } from '@/services/api';
import type { Course, CourseCreateRequest } from '@/types';

import { CourseForm } from './CourseForm';

export interface CourseEditModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
}

/** Inline modal to edit a course's name / description. */
export function CourseEditModal({ course, isOpen, onClose }: CourseEditModalProps) {
  const toast = useToast();
  const update = useUpdateCourse(course.id);

  const handleSubmit = (values: CourseCreateRequest) => {
    update.mutate(values, {
      onSuccess: () => {
        toast({ status: 'success', title: 'Course update aachu ✨' });
        onClose();
      },
      onError: (err) => {
        toast({ status: 'error', title: "Couldn't update the course", description: getErrorMessage(err) });
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent bg="bg.surface" borderRadius="2xl" mx={4}>
        <ModalHeader>Edit course</ModalHeader>
        <ModalCloseButton aria-label="Close edit course dialog" />
        <ModalBody pb={6}>
          {/* key resets the form state each time the modal opens */}
          {isOpen && (
            <CourseForm
              key={course.updatedAt}
              initialValues={{ name: course.name, description: course.description }}
              onSubmit={handleSubmit}
              isSubmitting={update.isPending}
              submitLabel="Save changes"
              onCancel={onClose}
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default CourseEditModal;
