import { Alert, AlertDescription, AlertIcon, Button, Skeleton, Stack, Text } from '@chakra-ui/react';
import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { GradientButton } from '@/components/ui/GradientButton';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { ShareableRoastCard } from '@/components/wall/ShareableRoastCard';
import { ShareActions } from '@/components/wall/ShareActions';
import { isNotFoundError } from '@/components/wall/wallUtils';
import { usePublicRoast } from '@/hooks/useWall';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';

/**
 * Public /r/:slug page (rendered inside PublicLayout, no auth).
 * OG meta tags can't be set client-side for crawlers, so only document.title is updated.
 */
export default function PublicRoastPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: roast, isPending, isError, error, refetch } = usePublicRoast(slug);

  useEffect(() => {
    if (!roast) return undefined;
    const previous = document.title;
    document.title = `“${roast.punchline}” — Kalaai Code`;
    return () => {
      document.title = previous;
    };
  }, [roast]);

  // Canonical link (no query/hash), independent of the router implementation.
  const shareUrl = `${typeof window === 'undefined' ? '' : window.location.origin}${paths.publicRoast(slug)}`;

  let body;
  if (!slug || isNotFoundError(error)) {
    body = (
      <EmptyState
        emoji="🕵️"
        title="Indha roast-a kaanom! Maybe unshare panniyirukkaanga."
        description="This roast link is invalid, or its owner made it private."
        action={<GradientButton to={ROUTES.register}>Get roasted too 🔥</GradientButton>}
      />
    );
  } else if (isPending) {
    body = (
      <Stack spacing={4} aria-hidden>
        <Skeleton h="360px" borderRadius="2xl" startColor="bg.subtle" endColor="bg.muted" />
        <Skeleton h="40px" w="60%" mx="auto" borderRadius="full" />
      </Stack>
    );
  } else if (isError) {
    body = (
      <Alert status="error" borderRadius="xl" flexWrap="wrap" gap={2}>
        <AlertIcon />
        <AlertDescription flex="1">{getErrorMessage(error)}</AlertDescription>
        <Button size="sm" variant="outline" colorScheme="red" onClick={() => void refetch()}>
          Try again
        </Button>
      </Alert>
    );
  } else {
    body = (
      <Stack spacing={6}>
        <ShareableRoastCard roast={roast} />
        <ShareActions
          url={shareUrl}
          title={`${roast.studentFirstName} got roasted on Kalaai Code`}
          text={`“${roast.punchline}” 🔥`}
        />
        <Text textAlign="center" fontSize="sm" color="text.muted">
          AI code review + Madurai-style kalaai. Unga code-um roast aaganuma? 😏
        </Text>
      </Stack>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <PageWrapper maxW="3xl" py={{ base: 8, md: 14 }}>
        {body}
      </PageWrapper>
    </MotionConfig>
  );
}
