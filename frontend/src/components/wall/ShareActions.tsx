import { Button, Flex, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { FiCheck, FiLink, FiShare2 } from 'react-icons/fi';

import { GradientButton } from '@/components/ui/GradientButton';
import { MotionBox } from '@/components/ui/motion';
import { ROUTES } from '@/lib/routes';

export interface ShareActionsProps {
  url: string;
  title: string;
  text: string;
}

function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/** Copy link · native share (when supported) · "Get roasted too" CTA. */
export function ShareActions({ url, title, text }: ShareActionsProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const nativeShare = canNativeShare();

  const handleCopy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ status: 'success', title: 'Link copied! Ippo share pannunga 🔥', duration: 2500 });
    } catch {
      toast({
        status: 'error',
        title: "Couldn't copy the link",
        description: 'Please copy it from the address bar.',
        isClosable: true,
      });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      if (isAbortError(err)) return;
      toast({ status: 'error', title: "Couldn't open the share sheet", description: 'Try copying the link instead.' });
    }
  };

  return (
    <Flex gap={3} flexWrap="wrap" justify="center" align="center">
      <MotionBox display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
        <Button
          variant="outline"
          colorScheme="brand"
          borderRadius="full"
          leftIcon={copied ? <FiCheck aria-hidden /> : <FiLink aria-hidden />}
          onClick={() => void handleCopy()}
        >
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
      </MotionBox>
      {nativeShare && (
        <MotionBox display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          <Button
            variant="outline"
            colorScheme="brand"
            borderRadius="full"
            leftIcon={<FiShare2 aria-hidden />}
            onClick={() => void handleShare()}
          >
            Share
          </Button>
        </MotionBox>
      )}
      <GradientButton to={ROUTES.register}>Get roasted too 🔥</GradientButton>
    </Flex>
  );
}

export default ShareActions;
