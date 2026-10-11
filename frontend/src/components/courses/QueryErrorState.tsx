import { Button, Flex, HStack } from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { ROUTES } from '@/lib/routes';
import { getErrorMessage, getErrorStatus } from '@/services/api';

export interface QueryErrorStateProps {
  error: unknown;
  /** Thing that failed to load, e.g. "course" or "assignment". */
  resource?: string;
  onRetry?: () => void;
  /** Where the "go back" link points (defaults to /courses). */
  backTo?: string;
  backLabel?: string;
}

/** Friendly error panel: 403 / 404 get their own copy, anything else offers a retry. */
export function QueryErrorState({
  error,
  resource = 'page',
  onRetry,
  backTo = ROUTES.courses,
  backLabel = 'Back to courses',
}: QueryErrorStateProps) {
  const status = getErrorStatus(error);

  let emoji = '😵';
  let title = `Couldn't load this ${resource}`;
  let description = getErrorMessage(error);
  let canRetry = Boolean(onRetry);

  if (status === 403) {
    emoji = '🚫';
    title = `You don't have access to this ${resource}`;
    description = 'Indha pakkam unga-ku illa, thambi. Ask your instructor if you think this is a mistake.';
    canRetry = false;
  } else if (status === 404) {
    emoji = '🔍';
    title = `This ${resource} doesn't exist`;
    description = 'Thedi thedi paathen, kidaikala! It may have been deleted or archived.';
    canRetry = false;
  }

  return (
    <Flex direction="column" role="alert">
      <EmptyState
        emoji={emoji}
        title={title}
        description={description}
        action={
          <HStack spacing={3} flexWrap="wrap" justify="center">
            {canRetry && onRetry && (
              <Button leftIcon={<FiRefreshCw />} variant="outline" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button as={RouterLink} to={backTo} variant="ghost">
              {backLabel}
            </Button>
          </HStack>
        }
      />
    </Flex>
  );
}

export default QueryErrorState;
