import { Box, SimpleGrid, Skeleton, SkeletonText, Stack } from '@chakra-ui/react';

/** Placeholder layout while GET /dashboard loads. */
export function DashboardSkeleton() {
  return (
    <Stack spacing={8} aria-busy="true" aria-label="Loading dashboard">
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h="104px" borderRadius="2xl" />
        ))}
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {[0, 1].map((col) => (
          <Box key={col} borderRadius="2xl" borderWidth="1px" borderColor="border.subtle" bg="bg.surface" p={6}>
            <Skeleton h={5} w="40%" mb={6} />
            <Stack spacing={5}>
              {[0, 1, 2].map((row) => (
                <SkeletonText key={row} noOfLines={2} spacing={3} skeletonHeight={3} />
              ))}
            </Stack>
          </Box>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

export default DashboardSkeleton;
