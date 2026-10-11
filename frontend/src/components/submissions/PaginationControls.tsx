import { Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { MotionBox } from '@/components/ui/motion';

export interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** e.g. while the next page is loading. */
  isDisabled?: boolean;
}

/** "Showing 21–40 of 57" + Previous / Next buttons. Renders nothing when everything fits on one page. */
export function PaginationControls({ page, pageSize, total, onPageChange, isDisabled = false }: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (total <= pageSize && page <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const canPrev = page > 1 && !isDisabled;
  const canNext = page < totalPages && !isDisabled;

  return (
    <Flex
      as="nav"
      aria-label="Pagination"
      direction={{ base: 'column', sm: 'row' }}
      align="center"
      justify="space-between"
      gap={3}
      mt={6}
    >
      <Text fontSize="sm" color="text.muted" aria-live="polite">
        Showing {from}–{to} of {total} · Page {page} of {totalPages}
      </Text>
      <HStack spacing={2}>
        <MotionBox whileHover={canPrev ? { y: -2 } : undefined} whileTap={canPrev ? { scale: 0.95 } : undefined}>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FiChevronLeft aria-hidden />}
            onClick={() => onPageChange(page - 1)}
            isDisabled={!canPrev}
            aria-label="Previous page"
          >
            Previous
          </Button>
        </MotionBox>
        <MotionBox whileHover={canNext ? { y: -2 } : undefined} whileTap={canNext ? { scale: 0.95 } : undefined}>
          <Button
            size="sm"
            variant="outline"
            rightIcon={<FiChevronRight aria-hidden />}
            onClick={() => onPageChange(page + 1)}
            isDisabled={!canNext}
            aria-label="Next page"
          >
            Next
          </Button>
        </MotionBox>
      </HStack>
    </Flex>
  );
}

export default PaginationControls;
