import { Avatar, HStack, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';

import { formatDate } from '@/components/assignments/dateUtils';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CourseStudent } from '@/types';

export interface StudentTableProps {
  students: CourseStudent[];
}

/** Enrolled students (instructor view). */
export function StudentTable({ students }: StudentTableProps) {
  if (students.length === 0) {
    return (
      <EmptyState
        emoji="🪑"
        title="No students yet"
        description="Class kaali-ya irukku! Share the join code so students can hop in."
      />
    );
  }

  return (
    <TableContainer borderWidth="1px" borderColor="border.subtle" borderRadius="2xl" bg="bg.surface">
      <Table variant="simple" size="md">
        <Thead>
          <Tr>
            <Th>Student</Th>
            <Th display={{ base: 'none', md: 'table-cell' }}>Email</Th>
            <Th>Joined</Th>
          </Tr>
        </Thead>
        <Tbody>
          {students.map((student) => {
            const displayName = student.fullName?.trim() || student.email;
            return (
              <Tr key={student.id}>
                <Td>
                  <HStack spacing={3}>
                    <Avatar size="sm" name={displayName} src={student.avatarUrl ?? undefined} />
                    <Text fontWeight={600} noOfLines={1}>
                      {displayName}
                    </Text>
                  </HStack>
                </Td>
                <Td display={{ base: 'none', md: 'table-cell' }} color="text.muted">
                  {student.email}
                </Td>
                <Td color="text.muted" whiteSpace="nowrap">
                  {formatDate(student.joinedAt)}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableContainer>
  );
}

export default StudentTable;
