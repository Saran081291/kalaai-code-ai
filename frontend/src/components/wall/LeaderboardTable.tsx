import {
  Avatar,
  Badge,
  HStack,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useEffect, useRef } from 'react';

import { GlassCard } from '@/components/ui/GlassCard';
import type { LeaderboardEntry } from '@/types';

export interface LeaderboardTableProps {
  entries: readonly LeaderboardEntry[];
  currentUserId?: number;
  tiedRanks: ReadonlySet<number>;
  /** Called when the current user's row scrolls in/out of view (false = below the fold). */
  onCurrentUserVisibilityChange?: (visible: boolean) => void;
}

/** Ranks 4+ of the leaderboard. */
export function LeaderboardTable({
  entries,
  currentUserId,
  tiedRanks,
  onCurrentUserVisibilityChange,
}: LeaderboardTableProps) {
  const myRowRef = useRef<HTMLTableRowElement>(null);
  const callbackRef = useRef(onCurrentUserVisibilityChange);
  const hasMe = entries.some((entry) => entry.studentId === currentUserId);

  useEffect(() => {
    callbackRef.current = onCurrentUserVisibilityChange;
  }, [onCurrentUserVisibilityChange]);

  useEffect(() => {
    const node = myRowRef.current;
    if (!hasMe || !node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((observed) => {
      const entry = observed[0];
      if (!entry) return;
      // Already scrolled past (above the viewport) counts as "seen".
      callbackRef.current?.(entry.isIntersecting || entry.boundingClientRect.top < 0);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      callbackRef.current?.(true);
    };
  }, [hasMe]);

  return (
    <GlassCard hoverable={false} p={0} overflow="hidden">
      <TableContainer>
        <Table size="md" variant="simple">
          <TableCaption placement="top" srOnly>
            Leaderboard rankings
          </TableCaption>
          <Thead>
            <Tr>
              <Th w="1%">Rank</Th>
              <Th>Student</Th>
              <Th isNumeric>Total score</Th>
              <Th isNumeric display={{ base: 'none', sm: 'table-cell' }}>
                Assignments done
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {entries.map((entry) => {
              const isMe = entry.studentId === currentUserId;
              const isTied = tiedRanks.has(entry.rank);
              return (
                <Tr
                  key={entry.studentId}
                  ref={isMe ? myRowRef : undefined}
                  bg={isMe ? 'brand.50' : undefined}
                  _dark={isMe ? { bg: 'whiteAlpha.100' } : undefined}
                  aria-current={isMe ? 'true' : undefined}
                  data-current-user={isMe ? 'true' : undefined}
                  _hover={{ bg: isMe ? undefined : 'bg.subtle' }}
                >
                  <Td fontFamily="heading" fontWeight={800}>
                    <HStack spacing={1.5}>
                      <Text as="span">#{entry.rank}</Text>
                      {isTied && (
                        <Badge colorScheme="purple" variant="subtle" borderRadius="full" fontSize="2xs">
                          Tie
                        </Badge>
                      )}
                    </HStack>
                  </Td>
                  <Td>
                    <HStack spacing={3} minW={0}>
                      <Avatar size="sm" name={entry.studentName} src={entry.avatarUrl ?? undefined} />
                      <Text fontWeight={isMe ? 700 : 500} noOfLines={1}>
                        {entry.studentName}
                      </Text>
                      {isMe && (
                        <Badge colorScheme="brand" variant="solid" borderRadius="full" flexShrink={0}>
                          Neenga dhaan! 👋
                        </Badge>
                      )}
                    </HStack>
                  </Td>
                  <Td isNumeric fontWeight={700}>
                    {entry.totalScore}
                  </Td>
                  <Td isNumeric display={{ base: 'none', sm: 'table-cell' }} color="text.muted">
                    {entry.assignmentsCompleted}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>
    </GlassCard>
  );
}

export default LeaderboardTable;
