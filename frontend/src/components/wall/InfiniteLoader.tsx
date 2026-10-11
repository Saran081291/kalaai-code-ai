import { Box, Button, Flex, Spinner, Text } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';

import { MotionBox } from '@/components/ui/motion';

export interface InfiniteLoaderProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** Text shown once everything is loaded. */
  endText?: string;
}

/** IntersectionObserver sentinel that loads the next page, with a "Load more" button fallback. */
export function InfiniteLoader({
  hasMore,
  isLoading,
  onLoadMore,
  endText = "Adhu dhaan ellaam! You've reached the end 🎤",
}: InfiniteLoaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading || typeof IntersectionObserver === 'undefined') return undefined;
    // Re-created after each load, so a still-visible sentinel triggers the next page too.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '0px 0px 320px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  return (
    <Flex direction="column" align="center" gap={3} py={6}>
      <Box ref={sentinelRef} h="1px" w="full" aria-hidden data-testid="wall-sentinel" />
      {hasMore ? (
        isLoading ? (
          <Flex role="status" align="center" gap={2} color="text.muted">
            <Spinner size="sm" color="accent.primary" />
            <Text fontSize="sm">Innum roast varudhu… loading more</Text>
          </Flex>
        ) : (
          <MotionBox display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Button variant="outline" colorScheme="brand" borderRadius="full" onClick={onLoadMore}>
              Load more
            </Button>
          </MotionBox>
        )
      ) : (
        <Text fontSize="sm" color="text.muted">
          {endText}
        </Text>
      )}
    </Flex>
  );
}

export default InfiniteLoader;
