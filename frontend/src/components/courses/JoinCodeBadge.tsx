import { Button, HStack, IconButton, Text, Tooltip, useDisclosure, useToast } from '@chakra-ui/react';
import { FiCopy, FiRefreshCw } from 'react-icons/fi';

import { ConfirmDialog } from './ConfirmDialog';

export interface JoinCodeBadgeProps {
  code: string;
  /** Show the "Regenerate" action (course owner). */
  canRegenerate?: boolean;
  /** Called after the user confirms; resolve/reject is handled by the caller (toasts etc.). */
  onRegenerate?: () => Promise<unknown>;
  isRegenerating?: boolean;
}

/** Join code pill with copy-to-clipboard and (owner) regenerate-with-confirm. */
export function JoinCodeBadge({ code, canRegenerate = false, onRegenerate, isRegenerating = false }: JoinCodeBadgeProps) {
  const toast = useToast();
  const confirm = useDisclosure();

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      toast({ status: 'success', title: 'Join code copied! Students-ku anuppunga 📋', duration: 2500 });
    } catch {
      toast({ status: 'error', title: "Couldn't copy the code", description: `Copy it manually: ${code}` });
    }
  };

  const handleConfirm = async () => {
    if (!onRegenerate) return;
    try {
      await onRegenerate();
    } finally {
      confirm.onClose();
    }
  };

  return (
    <HStack spacing={2} flexWrap="wrap">
      <HStack
        spacing={1}
        pl={4}
        pr={1}
        py={1}
        borderRadius="full"
        borderWidth="1px"
        borderColor="border.strong"
        bg="bg.subtle"
      >
        <Text fontSize="xs" color="text.muted" fontWeight={600} textTransform="uppercase">
          Join code
        </Text>
        <Text fontFamily="mono" fontWeight={800} letterSpacing="0.2em" data-testid="join-code">
          {code}
        </Text>
        <Tooltip label="Copy join code" hasArrow>
          <IconButton
            aria-label="Copy join code"
            icon={<FiCopy />}
            size="sm"
            variant="ghost"
            borderRadius="full"
            onClick={() => void handleCopy()}
          />
        </Tooltip>
      </HStack>
      {canRegenerate && onRegenerate && (
        <>
          <Button size="sm" variant="ghost" leftIcon={<FiRefreshCw />} onClick={confirm.onOpen}>
            Regenerate
          </Button>
          <ConfirmDialog
            isOpen={confirm.isOpen}
            onClose={confirm.onClose}
            onConfirm={() => void handleConfirm()}
            title="Regenerate join code?"
            body="The current code will stop working immediately. Students who already joined stay enrolled."
            confirmLabel="Regenerate"
            confirmColorScheme="orange"
            isLoading={isRegenerating}
          />
        </>
      )}
    </HStack>
  );
}

export default JoinCodeBadge;
