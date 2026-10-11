import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  Switch,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';

import { paths } from '@/lib/routes';
import type { Roast } from '@/types';

export interface ShareToggleProps {
  roast: Roast;
  onToggle: (isShared: boolean) => void;
  isLoading?: boolean;
}

function publicRoastUrl(shareSlug: string): string {
  return `${window.location.origin}${paths.publicRoast(shareSlug)}`;
}

/** Owner student: share on the Roast Wall + public link with copy button. */
export function ShareToggle({ roast, onToggle, isLoading = false }: ShareToggleProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const link = roast.isShared && roast.shareSlug ? publicRoastUrl(roast.shareSlug) : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ status: 'success', title: 'Link copied! Friends-ku anuppunga 📤', duration: 2500 });
    } catch {
      toast({ status: 'error', title: 'Could not copy the link', description: 'Please copy it manually.' });
    }
  };

  return (
    <Stack spacing={3}>
      <FormControl display="flex" alignItems="center" gap={3}>
        <Switch
          id="roast-share"
          isChecked={roast.isShared}
          isDisabled={isLoading}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <FormLabel htmlFor="roast-share" mb={0} fontWeight={600}>
          Roast Wall-la share pannu
        </FormLabel>
      </FormControl>
      <Text color="text.muted" fontSize="sm">
        Shared roasts appear on your course Roast Wall and get a public link (no code or email is shown).
      </Text>
      {link && (
        <Flex direction="column" gap={1}>
          <FormControl>
            <FormLabel htmlFor="roast-public-link" fontSize="sm" mb={1}>
              Public link
            </FormLabel>
            <InputGroup size="md">
              <Input
                id="roast-public-link"
                value={link}
                isReadOnly
                fontFamily="mono"
                fontSize="sm"
                pr="6.5rem"
                onFocus={(event) => event.target.select()}
              />
              <InputRightElement w="6rem" pr={1}>
                <Button
                  size="sm"
                  h="1.9rem"
                  leftIcon={copied ? <FiCheck /> : <FiCopy />}
                  onClick={() => void copy()}
                  aria-label="Copy public link"
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </InputRightElement>
            </InputGroup>
          </FormControl>
        </Flex>
      )}
    </Stack>
  );
}

export default ShareToggle;
