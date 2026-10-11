import { Box, Divider, Flex, Heading, Stack, Text } from '@chakra-ui/react';

import { GlassCard } from '@/components/ui/GlassCard';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { SpiceChip } from '@/components/ui/SpiceChip';
import { SPICE_META } from '@/lib/spice';
import type { PublicRoast } from '@/types';

import { SPICE_GRADIENT } from './wallUtils';

export interface ShareableRoastCardProps {
  roast: PublicRoast;
}

/** Big, screenshot-friendly roast card for the public /r/:slug page. */
export function ShareableRoastCard({ roast }: ShareableRoastCardProps) {
  const spice = SPICE_META[roast.spiceLevel];

  return (
    <GlassCard hoverable={false} p={0} overflow="hidden" role="article" aria-label="Shared roast">
      <Box h="10px" bgGradient={SPICE_GRADIENT[roast.spiceLevel]} aria-hidden />
      <Stack spacing={{ base: 5, md: 6 }} p={{ base: 5, md: 10 }}>
        <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
          <SpiceChip level={roast.spiceLevel} size="lg" />
          <Text fontSize="sm" color="text.muted" fontWeight={600}>
            Kalaai Code 🌶️
          </Text>
        </Flex>

        <Box as="blockquote" borderLeftWidth="6px" borderLeftColor={spice.color} pl={{ base: 4, md: 6 }}>
          <Heading
            as="p"
            fontSize={{ base: '2xl', sm: '3xl', md: '4xl' }}
            lineHeight="short"
            fontWeight={800}
            color="text.primary"
          >
            “{roast.punchline}”
          </Heading>
        </Box>

        <Flex direction={{ base: 'column', sm: 'row' }} align={{ base: 'flex-start', sm: 'center' }} gap={5}>
          <ScoreRing score={roast.effectiveScore} max={roast.maxScore} size="96px" thickness="9px" label="Score" />
          <Text fontSize={{ base: 'md', md: 'lg' }} color="text.muted">
            🔥{' '}
            <Text as="strong" color="text.primary">
              {roast.studentFirstName}
            </Text>{' '}
            got roasted on{' '}
            <Text as="strong" color="text.accent">
              {roast.assignmentTitle}
            </Text>
          </Text>
        </Flex>

        <Divider borderColor="border.subtle" />

        <Box>
          <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="wider" color="text.muted" mb={2}>
            Full roast
          </Text>
          <Text whiteSpace="pre-wrap" wordBreak="break-word" fontSize={{ base: 'md', md: 'lg' }} lineHeight="tall">
            {roast.content}
          </Text>
        </Box>
      </Stack>
    </GlassCard>
  );
}

export default ShareableRoastCard;
