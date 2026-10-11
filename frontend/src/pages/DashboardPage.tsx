import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Button, Flex, Heading, Text, VisuallyHidden } from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';

import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { getFirstName, getTimeOfDayLine } from '@/components/dashboard/dashboardUtils';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { getErrorMessage } from '@/services/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch, isRefetching } = useDashboard();
  const firstName = getFirstName(user);

  return (
    <PageWrapper>
      <Box as="header" mb={8}>
        <Text
          aria-hidden="true"
          fontSize="xs"
          fontWeight={700}
          letterSpacing="widest"
          textTransform="uppercase"
          color="text.accent"
          mb={1}
        >
          Dashboard
        </Text>
        <Heading as="h1" size={{ base: 'lg', md: 'xl' }}>
          <VisuallyHidden>Dashboard — </VisuallyHidden>
          Vanakkam, {firstName}! 👋
        </Heading>
        <Text color="text.muted" mt={2}>
          {getTimeOfDayLine()}
        </Text>
      </Box>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <Alert
          status="error"
          variant="subtle"
          borderRadius="xl"
          flexDirection={{ base: 'column', sm: 'row' }}
          alignItems={{ base: 'flex-start', sm: 'center' }}
          gap={3}
        >
          <Flex align="flex-start" flex={1}>
            <AlertIcon />
            <Box>
              <AlertTitle>Dashboard load aagala</AlertTitle>
              <AlertDescription>{getErrorMessage(error)}</AlertDescription>
            </Box>
          </Flex>
          <Button
            leftIcon={<FiRefreshCw />}
            size="sm"
            variant="outline"
            colorScheme="red"
            onClick={() => void refetch()}
            isLoading={isRefetching}
          >
            Try again
          </Button>
        </Alert>
      ) : data.role === 'student' ? (
        <StudentDashboard data={data} />
      ) : (
        <InstructorDashboard data={data} />
      )}
    </PageWrapper>
  );
}
