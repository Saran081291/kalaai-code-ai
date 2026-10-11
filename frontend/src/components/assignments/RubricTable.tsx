import { Table, TableCaption, TableContainer, Tbody, Td, Text, Tfoot, Th, Thead, Tr } from '@chakra-ui/react';

import { EmptyState } from '@/components/ui/EmptyState';
import type { RubricCriterion } from '@/types';

export interface RubricTableProps {
  criteria: RubricCriterion[];
  maxScore: number;
}

/** Read-only rubric: criterion, description, points, total. */
export function RubricTable({ criteria, maxScore }: RubricTableProps) {
  if (criteria.length === 0) {
    return <EmptyState emoji="📏" title="No rubric yet" description="Rubric innum ready aagala." />;
  }

  const sorted = [...criteria].sort((a, b) => a.position - b.position);
  const total = sorted.reduce((sum, c) => sum + c.maxPoints, 0);

  return (
    <TableContainer borderWidth="1px" borderColor="border.subtle" borderRadius="2xl" bg="bg.surface" whiteSpace="normal">
      <Table size="md">
        <TableCaption placement="top" textAlign="left" mt={0} color="text.muted">
          Grading rubric — the AI reviewer scores each criterion separately.
        </TableCaption>
        <Thead>
          <Tr>
            <Th>Criterion</Th>
            <Th display={{ base: 'none', md: 'table-cell' }}>Description</Th>
            <Th isNumeric>Points</Th>
          </Tr>
        </Thead>
        <Tbody>
          {sorted.map((c) => (
            <Tr key={c.id}>
              <Td fontWeight={600} verticalAlign="top">
                {c.name}
                <Text display={{ base: 'block', md: 'none' }} fontWeight={400} fontSize="sm" color="text.muted" mt={1} whiteSpace="pre-wrap">
                  {c.description}
                </Text>
              </Td>
              <Td display={{ base: 'none', md: 'table-cell' }} color="text.muted" whiteSpace="pre-wrap" verticalAlign="top">
                {c.description || '—'}
              </Td>
              <Td isNumeric verticalAlign="top">
                {c.maxPoints}
              </Td>
            </Tr>
          ))}
        </Tbody>
        <Tfoot>
          <Tr>
            <Th>Total</Th>
            <Th display={{ base: 'none', md: 'table-cell' }} />
            <Th isNumeric color={total === maxScore ? undefined : 'orange.500'}>
              {total} / {maxScore}
            </Th>
          </Tr>
        </Tfoot>
      </Table>
    </TableContainer>
  );
}

export default RubricTable;
