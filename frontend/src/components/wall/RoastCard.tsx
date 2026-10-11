import { Avatar, Badge, Box, Button, Collapse, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { useId, useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { GlassCard } from '@/components/ui/GlassCard';
import { MotionBox } from '@/components/ui/motion';
import { SpiceChip } from '@/components/ui/SpiceChip';
import { SPICE_META } from '@/lib/spice';
import type { ReactionType, RoastWallItem } from '@/types';

import { ReactionBar } from './ReactionBar';
import { SPICE_GRADIENT, formatRelativeTime } from './wallUtils';

export interface RoastCardProps {
  item: RoastWallItem;
  onReact: (reaction: ReactionType, active: boolean) => void;
}

/** One roast on the course Roast Wall. */
export function RoastCard({ item, onReact }: RoastCardProps) {
  const [expanded, setExpanded] = useState(false);
  const baseId = useId();
  const punchlineId = `${baseId}-punchline`;
  const contentId = `${baseId}-content`;
  const spice = SPICE_META[item.spiceLevel];
  const hasScore = typeof item.effectiveScore === 'number' && typeof item.maxScore === 'number';

  return (
    <GlassCard
      role="article"
      aria-labelledby={punchlineId}
      p={0}
      overflow="hidden"
      whileHover={{ y: -3 }}
      data-testid="roast-card"
    >
      <Box h="6px" bgGradient={SPICE_GRADIENT[item.spiceLevel]} aria-hidden />
      <Stack spacing={4} p={{ base: 4, md: 6 }}>
        <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap">
          <HStack spacing={3} minW={0} flex="1">
            <Avatar size="sm" name={item.studentName} src={item.studentAvatarUrl ?? undefined} />
            <Box minW={0}>
              <Text fontWeight={700} noOfLines={1}>
                {item.studentName}
              </Text>
              <Text fontSize="sm" color="text.muted" noOfLines={1}>
                on {item.assignmentTitle}
              </Text>
            </Box>
          </HStack>
          <HStack spacing={2} flexShrink={0}>
            <SpiceChip level={item.spiceLevel} size="sm" chiliesOnly />
            {hasScore && (
              <Badge
                colorScheme="brand"
                variant="subtle"
                borderRadius="full"
                px={2.5}
                aria-label={`Score ${item.effectiveScore} out of ${item.maxScore}`}
              >
                {item.effectiveScore}/{item.maxScore}
              </Badge>
            )}
          </HStack>
        </Flex>

        <Box as="blockquote" borderLeftWidth="4px" borderLeftColor={spice.color} pl={4}>
          <Text
            id={punchlineId}
            fontFamily="heading"
            fontWeight={800}
            fontSize={{ base: 'xl', md: '2xl' }}
            lineHeight="short"
            color="text.primary"
          >
            “{item.punchline}”
          </Text>
        </Box>

        <Collapse in={expanded} animateOpacity>
          <Box id={contentId} bg="bg.subtle" borderRadius="xl" p={4}>
            <Text whiteSpace="pre-wrap" wordBreak="break-word" color="text.primary" fontSize="sm">
              {item.content}
            </Text>
          </Box>
        </Collapse>

        <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
          <ReactionBar counts={item.reactionCounts} myReactions={item.myReactions} onToggle={onReact} />
          <HStack spacing={3}>
            <MotionBox display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button
                size="sm"
                variant="ghost"
                colorScheme="brand"
                aria-expanded={expanded}
                aria-controls={contentId}
                rightIcon={expanded ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? 'Hide full roast' : 'Full roast padi'}
              </Button>
            </MotionBox>
            <Text
              as="time"
              dateTime={item.createdAt}
              title={new Date(item.createdAt).toLocaleString()}
              fontSize="xs"
              color="text.muted"
              whiteSpace="nowrap"
            >
              {formatRelativeTime(item.createdAt)}
            </Text>
          </HStack>
        </Flex>
      </Stack>
    </GlassCard>
  );
}

export default RoastCard;
