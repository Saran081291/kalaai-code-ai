import { Heading, Stack, Text } from '@chakra-ui/react';

import { GradientButton } from '@/components/ui/GradientButton';
import { PageWrapper } from '@/components/ui/PageWrapper';

export default function NotFoundPage() {
  return (
    <PageWrapper maxW="lg" py={{ base: 16, md: 24 }}>
      <Stack spacing={4} align="center" textAlign="center">
        <Text fontSize="6xl" aria-hidden>
          🧭
        </Text>
        <Heading size="2xl">404</Heading>
        <Text color="text.muted" fontSize="lg">
          Enna ya, vazhi thavariteenga! Indha page Mattuthavani bus stand-la kooda illa.
        </Text>
        <GradientButton to="/">Veetuku po (Home)</GradientButton>
      </Stack>
    </PageWrapper>
  );
}
