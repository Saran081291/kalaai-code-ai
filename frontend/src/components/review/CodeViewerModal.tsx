import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';

import { CodeViewer } from './CodeViewer';
import type { CodeTarget } from './reviewUtils';

export interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: number;
  target: CodeTarget | null;
}

/** CodeViewer in a modal (full screen on mobile). Files are only fetched while open. */
export function CodeViewerModal({ isOpen, onClose, submissionId, target }: CodeViewerModalProps) {
  const title = target?.file ? (target.line ? `${target.file} · line ${target.line}` : target.file) : 'Submitted code';
  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: '6xl' }} scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="bg.surface" borderRadius={{ base: 0, md: '2xl' }}>
        <ModalHeader pr={12} fontSize="md" fontFamily="mono" wordBreak="break-all">
          {title}
        </ModalHeader>
        <ModalCloseButton aria-label="Close code viewer" />
        <ModalBody pb={6}>
          {isOpen && (
            <CodeViewer
              key={`${target?.file ?? ''}:${target?.line ?? ''}`}
              submissionId={submissionId}
              target={target}
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default CodeViewerModal;
