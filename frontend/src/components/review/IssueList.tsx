import { Badge, Box, Button, chakra, Flex, Heading, HStack, Icon, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { FiChevronRight, FiFileText } from 'react-icons/fi';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { SEVERITY_COLOR_SCHEME } from '@/lib/status';
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES, type IssueCategory, type IssueSeverity, type ReviewIssue } from '@/types';

import { sortIssues } from './reviewUtils';

export interface IssueListProps {
  issues: ReviewIssue[];
  /** Open the CodeViewer at this issue's file/line. */
  onSelectIssue: (issue: ReviewIssue) => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function location(issue: ReviewIssue): string {
  return issue.line ? `${issue.file}:${issue.line}` : issue.file;
}

const IssueButton = chakra('button');

/** Filterable list of review issues; clicking one jumps to the code. */
export function IssueList({ issues, onSelectIssue }: IssueListProps) {
  const [severities, setSeverities] = useState<IssueSeverity[]>([]);
  const [categories, setCategories] = useState<IssueCategory[]>([]);

  const sorted = useMemo(() => sortIssues(issues), [issues]);
  const severityCounts = useMemo(() => countBy(issues, (issue) => issue.severity), [issues]);
  const categoryCounts = useMemo(() => countBy(issues, (issue) => issue.category), [issues]);

  const visible = sorted.filter(
    (issue) =>
      (severities.length === 0 || severities.includes(issue.severity)) &&
      (categories.length === 0 || categories.includes(issue.category)),
  );

  const presentSeverities = ISSUE_SEVERITIES.filter((s) => (severityCounts.get(s) ?? 0) > 0);
  const presentCategories = ISSUE_CATEGORIES.filter((c) => (categoryCounts.get(c) ?? 0) > 0);

  return (
    <Box as="section" aria-labelledby="issues-heading">
      <Heading id="issues-heading" as="h3" size="md" mb={3}>
        Issues ({issues.length})
      </Heading>

      {issues.length === 0 ? (
        <EmptyState emoji="🎉" title="Clean code! Issues edhuvum illa" description="The AI found nothing to flag. Gethu!" />
      ) : (
        <Stack spacing={4}>
          <Stack spacing={2} aria-label="Issue filters" role="group">
            <Wrap spacing={2}>
              {presentSeverities.map((severity) => {
                const active = severities.includes(severity);
                return (
                  <WrapItem key={severity}>
                    <Button
                      size="xs"
                      borderRadius="full"
                      colorScheme={SEVERITY_COLOR_SCHEME[severity]}
                      variant={active ? 'solid' : 'outline'}
                      aria-pressed={active}
                      onClick={() => setSeverities((prev) => toggle(prev, severity))}
                      textTransform="capitalize"
                    >
                      {severity} ({severityCounts.get(severity)})
                    </Button>
                  </WrapItem>
                );
              })}
            </Wrap>
            <Wrap spacing={2}>
              {presentCategories.map((category) => {
                const active = categories.includes(category);
                return (
                  <WrapItem key={category}>
                    <Button
                      size="xs"
                      borderRadius="full"
                      colorScheme="gray"
                      variant={active ? 'solid' : 'outline'}
                      aria-pressed={active}
                      onClick={() => setCategories((prev) => toggle(prev, category))}
                      textTransform="capitalize"
                    >
                      {category} ({categoryCounts.get(category)})
                    </Button>
                  </WrapItem>
                );
              })}
              {(severities.length > 0 || categories.length > 0) && (
                <WrapItem>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setSeverities([]);
                      setCategories([]);
                    }}
                  >
                    Clear filters
                  </Button>
                </WrapItem>
              )}
            </Wrap>
          </Stack>

          {visible.length === 0 ? (
            <Text color="text.muted">No issues match these filters.</Text>
          ) : (
            <AnimatedList spacing={3} stagger={0.04}>
              {visible.map((issue, index) => (
                <IssueButton
                  key={`${issue.file}-${issue.line ?? 'x'}-${index}`}
                  type="button"
                  onClick={() => onSelectIssue(issue)}
                  w="full"
                  textAlign="left"
                  bg="bg.surface"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderLeftWidth="4px"
                  borderLeftColor={`${SEVERITY_COLOR_SCHEME[issue.severity]}.400`}
                  borderRadius="xl"
                  p={4}
                  transitionProperty="common"
                  transitionDuration="normal"
                  _hover={{ boxShadow: 'md', borderColor: 'brand.300', transform: 'translateY(-2px)' }}
                  _focusVisible={{ outline: '2px solid', outlineColor: 'accent.primary' }}
                  data-testid="issue-item"
                >
                  <Stack spacing={2}>
                    <Flex gap={2} align="center" flexWrap="wrap">
                      <Badge colorScheme={SEVERITY_COLOR_SCHEME[issue.severity]} textTransform="capitalize">
                        {issue.severity}
                      </Badge>
                      <Badge variant="outline" textTransform="capitalize">
                        {issue.category}
                      </Badge>
                      <HStack spacing={1} color="text.muted" fontFamily="mono" fontSize="sm" minW={0}>
                        <Icon as={FiFileText} aria-hidden />
                        <Text as="span" wordBreak="break-all">
                          {location(issue)}
                        </Text>
                      </HStack>
                    </Flex>
                    <Text fontWeight={600} whiteSpace="pre-wrap">
                      {issue.message}
                    </Text>
                    {issue.suggestion && (
                      <Text fontSize="sm" color="text.muted" whiteSpace="pre-wrap">
                        <Text as="span" fontWeight={700}>
                          Suggestion:{' '}
                        </Text>
                        {issue.suggestion}
                      </Text>
                    )}
                    <HStack spacing={1} color="text.accent" fontSize="sm" fontWeight={600}>
                      <Text as="span">View code</Text>
                      <Icon as={FiChevronRight} aria-hidden />
                    </HStack>
                  </Stack>
                </IssueButton>
              ))}
            </AnimatedList>
          )}
        </Stack>
      )}
    </Box>
  );
}

function countBy<K>(issues: ReviewIssue[], key: (issue: ReviewIssue) => K): Map<K, number> {
  const counts = new Map<K, number>();
  issues.forEach((issue) => counts.set(key(issue), (counts.get(key(issue)) ?? 0) + 1));
  return counts;
}

export default IssueList;
