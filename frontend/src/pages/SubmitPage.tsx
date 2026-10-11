import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { FiArrowLeft, FiCalendar, FiGithub, FiUploadCloud } from 'react-icons/fi';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import {
  AttemptsRemaining,
  FileDropzone,
  formatDateTime,
  formatRelativeTime,
  getSubmissionErrorMessage,
  GitHubUrlInput,
  GITHUB_URL_ERROR,
  isValidGithubUrl,
  SpiceSelector,
  validateUploadFiles,
} from '@/components/submissions';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { useCreateSubmission, useSubmissionAssignment } from '@/hooks/useSubmissions';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';
import type { SpiceLevel, SubmissionCreateInput } from '@/types';

type SourceTab = 'github' | 'upload';
const TAB_ORDER: readonly SourceTab[] = ['github', 'upload'];

const SUCCESS_TOAST = 'Code submit aachu! Review start aagudhu 🔥';

export default function SubmitPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const assignmentQuery = useSubmissionAssignment(assignmentId);
  const createSubmission = useCreateSubmission(assignmentId);

  const [source, setSource] = useState<SourceTab>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubTouched, setGithubTouched] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(user?.defaultSpiceLevel ?? 'medium');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return (
      <PageWrapper maxW="3xl">
        <EmptyState
          emoji="🤔"
          title="Assignment not found"
          description="Indha assignment-a kandupidikka mudiyala."
          action={<GradientButton to={ROUTES.courses}>Back to courses</GradientButton>}
        />
      </PageWrapper>
    );
  }

  if (assignmentQuery.isPending) {
    return <LoadingScreen fullScreen={false} text="Assignment details load aagudhu…" />;
  }

  if (assignmentQuery.isError) {
    return (
      <PageWrapper maxW="3xl">
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{getErrorMessage(assignmentQuery.error)}</AlertDescription>
        </Alert>
      </PageWrapper>
    );
  }

  const assignment = assignmentQuery.data;
  const attemptsUsed = assignment.myAttemptsCount ?? 0;
  const attemptsLeft = Math.max(0, assignment.maxAttempts - attemptsUsed);
  const noAttemptsLeft = attemptsLeft === 0;
  const isPastDue = assignment.dueDate !== null && new Date(assignment.dueDate).getTime() < Date.now();
  const closedForLate = isPastDue && !assignment.allowLate;
  const isBlocked = noAttemptsLeft || closedForLate;

  const trimmedUrl = githubUrl.trim();
  const githubError =
    (githubTouched || submitAttempted) && !isValidGithubUrl(trimmedUrl) ? GITHUB_URL_ERROR : undefined;
  const uploadErrors = validateUploadFiles(files);
  const missingFiles = submitAttempted && source === 'upload' && files.length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setApiError(null);
    if (isBlocked) return;

    let input: SubmissionCreateInput;
    if (source === 'github') {
      if (!isValidGithubUrl(trimmedUrl)) return;
      input = { spiceLevel, githubUrl: trimmedUrl };
    } else {
      if (files.length === 0 || uploadErrors.length > 0) return;
      input = { spiceLevel, files };
    }

    try {
      const submission = await createSubmission.mutateAsync(input);
      toast({ status: 'success', title: SUCCESS_TOAST, duration: 4000, isClosable: true });
      navigate(paths.submissionResult(submission.id));
    } catch (err) {
      setApiError(getSubmissionErrorMessage(err));
    }
  };

  return (
    <PageWrapper maxW="4xl">
      <Button
        as={RouterLink}
        to={paths.assignmentDetail(assignment.id)}
        variant="ghost"
        size="sm"
        leftIcon={<FiArrowLeft aria-hidden />}
        mb={4}
      >
        Back to assignment
      </Button>

      <Stack spacing={1} mb={6}>
        <Text fontSize="sm" fontWeight={600} color="text.accent" textTransform="uppercase" letterSpacing="wide">
          Submit code
        </Text>
        <Heading size="xl">{assignment.title}</Heading>
        <Text color="text.muted">Code-a podu, spice-a choose pannu 🌶️🌶️🌶️</Text>
      </Stack>

      <Stack as="form" spacing={6} onSubmit={handleSubmit} noValidate aria-label="Submit your code">
        <GlassCard hoverable={false}>
          <Stack spacing={4}>
            <Flex direction={{ base: 'column', sm: 'row' }} gap={{ base: 2, sm: 6 }} justify="space-between">
              <HStack spacing={2} color="text.muted">
                <FiCalendar aria-hidden />
                <Text fontSize="sm">
                  {assignment.dueDate ? (
                    <>
                      Due <b>{formatDateTime(assignment.dueDate)}</b> ({formatRelativeTime(assignment.dueDate)})
                    </>
                  ) : (
                    'No due date'
                  )}
                </Text>
              </HStack>
              {!noAttemptsLeft && (
                <Text fontSize="sm" color="text.muted">
                  This will be attempt #{assignment.myNextAttemptNumber ?? attemptsUsed + 1}
                </Text>
              )}
            </Flex>
            <AttemptsRemaining used={attemptsUsed} max={assignment.maxAttempts} />

            {noAttemptsLeft && (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                <Box>
                  <AlertTitle>No attempts left</AlertTitle>
                  <AlertDescription>
                    You have used all {assignment.maxAttempts} attempts. Attempts ellam mudinjiduchu, thambi.
                  </AlertDescription>
                </Box>
              </Alert>
            )}
            {!noAttemptsLeft && closedForLate && (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                <Box>
                  <AlertTitle>Submissions closed</AlertTitle>
                  <AlertDescription>
                    The due date has passed and late submissions are not allowed. Deadline mudinjiduchu 😔
                  </AlertDescription>
                </Box>
              </Alert>
            )}
            {!noAttemptsLeft && isPastDue && assignment.allowLate && (
              <Alert status="warning" borderRadius="xl">
                <AlertIcon />
                <AlertDescription>
                  The due date has passed — this submission will be marked <b>late</b>. Late-aa vandhaalum
                  latest-aa vaa!
                </AlertDescription>
              </Alert>
            )}
          </Stack>
        </GlassCard>

        <GlassCard hoverable={false}>
          <Heading as="h2" size="md" mb={4}>
            1. Your code
          </Heading>
          <Tabs
            variant="soft-rounded"
            colorScheme="brand"
            index={TAB_ORDER.indexOf(source)}
            onChange={(index) => setSource(TAB_ORDER[index] ?? 'github')}
            isLazy={false}
          >
            <TabList gap={2} flexWrap="wrap">
              <Tab gap={2} display="inline-flex" alignItems="center">
                <FiGithub aria-hidden /> GitHub URL
              </Tab>
              <Tab gap={2} display="inline-flex" alignItems="center">
                <FiUploadCloud aria-hidden /> Upload files
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel px={0} pb={0}>
                <GitHubUrlInput
                  value={githubUrl}
                  onChange={setGithubUrl}
                  onBlur={() => setGithubTouched(true)}
                  error={githubError}
                  isDisabled={isBlocked || createSubmission.isPending}
                />
              </TabPanel>
              <TabPanel px={0} pb={0}>
                <FileDropzone
                  files={files}
                  onFilesChange={setFiles}
                  isDisabled={isBlocked || createSubmission.isPending}
                />
                {missingFiles && (
                  <Text role="alert" color="red.500" fontSize="sm" mt={2}>
                    Add at least one code file or a .zip to submit.
                  </Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GlassCard>

        <GlassCard hoverable={false}>
          <Heading as="h2" size="md" mb={1}>
            2. Pick your roast spice
          </Heading>
          <Text fontSize="sm" color="text.muted" mb={4}>
            Evvalavu kaaram venum? Choose how hard the roast hits.
          </Text>
          <SpiceSelector value={spiceLevel} onChange={setSpiceLevel} isDisabled={createSubmission.isPending} />
          <Text fontSize="sm" color="text.muted" mt={4} textAlign="center">
            Roast code-ku mattum dhaan, person-ku illa 🙏
          </Text>
        </GlassCard>

        {apiError && (
          <Alert status="error" borderRadius="xl" role="alert">
            <AlertIcon />
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <Flex justify="flex-end">
          <GradientButton
            type="submit"
            size="lg"
            isLoading={createSubmission.isPending}
            loadingText="Submitting…"
            isDisabled={isBlocked}
            fullWidth
          >
            Submit for review 🔥
          </GradientButton>
        </Flex>
      </Stack>
    </PageWrapper>
  );
}
