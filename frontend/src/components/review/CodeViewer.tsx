import {
  Alert,
  AlertIcon,
  Box,
  Button,
  chakra,
  Flex,
  Select,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
} from '@chakra-ui/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useSubmissionFiles } from '@/hooks/useReview';
import { getErrorMessage } from '@/services/api';
import type { SubmissionFile } from '@/types';

import { findFile, getLineWindow, type CodeTarget } from './reviewUtils';

export interface CodeViewerProps {
  submissionId: number;
  /** File/line to open and highlight (from a clicked issue). */
  target?: CodeTarget | null;
}

interface CodeLineProps {
  number: number;
  text: string;
  highlighted: boolean;
}

const LineRow = chakra('div');

const CodeLine = memo(
  function CodeLine({ number, text, highlighted }: CodeLineProps) {
    return (
      <LineRow
        display="flex"
        bg={highlighted ? 'brand.100' : undefined}
        _dark={highlighted ? { bg: 'whiteAlpha.200' } : undefined}
        borderLeftWidth="3px"
        borderLeftColor={highlighted ? 'accent.primary' : 'transparent'}
        aria-current={highlighted ? 'true' : undefined}
        data-line={number}
        data-highlighted={highlighted ? 'true' : undefined}
      >
        <chakra.span
          flexShrink={0}
          w="4.5em"
          pr={3}
          textAlign="right"
          color="text.muted"
          userSelect="none"
          aria-hidden
        >
          {number}
        </chakra.span>
        <chakra.span whiteSpace="pre" pr={4}>
          {text.length > 0 ? text : ' '}
        </chakra.span>
      </LineRow>
    );
  },
);

/** Read-only code view: file list + numbered lines (plain text, no HTML injection). */
export function CodeViewer({ submissionId, target = null }: CodeViewerProps) {
  const filesQuery = useSubmissionFiles(submissionId, true);
  const files = useMemo<SubmissionFile[]>(() => filesQuery.data ?? [], [filesQuery.data]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const targetFile = useMemo(() => findFile(files, target?.file), [files, target?.file]);
  const selected = files.find((file) => file.id === selectedId) ?? targetFile ?? files[0];
  const highlightLine = selected && targetFile && selected.id === targetFile.id ? (target?.line ?? null) : null;

  const lines = useMemo(() => (selected ? selected.content.replace(/\r\n/g, '\n').split('\n') : []), [selected]);
  const lineWindow = getLineWindow(lines.length, highlightLine);

  const highlightRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const row = highlightRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
    row?.scrollIntoView?.({ block: 'center' });
  }, [selected?.id, highlightLine]);

  if (filesQuery.isLoading) {
    return (
      <Stack spacing={2} aria-busy="true" aria-label="Loading code">
        <Skeleton h="24px" />
        <Skeleton h="300px" />
      </Stack>
    );
  }

  if (filesQuery.isError) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        {getErrorMessage(filesQuery.error, 'Could not load the submitted code.')}
      </Alert>
    );
  }

  if (files.length === 0 || !selected) {
    return <Text color="text.muted">No code files found for this submission.</Text>;
  }

  const missingTarget = Boolean(target?.file) && !targetFile;

  return (
    <Flex direction={{ base: 'column', md: 'row' }} gap={4} minH={0}>
      {/* Mobile: select */}
      <Box display={{ base: 'block', md: 'none' }}>
        <Select
          aria-label="Choose file"
          value={selected.id}
          onChange={(event) => setSelectedId(Number(event.target.value))}
          fontFamily="mono"
          size="sm"
        >
          {files.map((file) => (
            <option key={file.id} value={file.id}>
              {file.path}
            </option>
          ))}
        </Select>
      </Box>

      {/* Desktop: file list */}
      <Box
        as="nav"
        aria-label="Submitted files"
        display={{ base: 'none', md: 'block' }}
        w="240px"
        flexShrink={0}
        maxH="65vh"
        overflowY="auto"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="lg"
        p={2}
      >
        <Stack spacing={1}>
          {files.map((file) => (
            <Button
              key={file.id}
              size="sm"
              variant={file.id === selected.id ? 'solid' : 'ghost'}
              colorScheme={file.id === selected.id ? 'brand' : 'gray'}
              justifyContent="flex-start"
              fontFamily="mono"
              fontWeight={500}
              fontSize="xs"
              whiteSpace="normal"
              wordBreak="break-all"
              textAlign="left"
              h="auto"
              py={1.5}
              aria-current={file.id === selected.id ? 'true' : undefined}
              onClick={() => setSelectedId(file.id)}
            >
              {file.path}
            </Button>
          ))}
        </Stack>
      </Box>

      <Stack flex="1" minW={0} spacing={2}>
        <Flex justify="space-between" gap={2} flexWrap="wrap" fontSize="sm">
          <Text fontFamily="mono" fontWeight={700} wordBreak="break-all" data-testid="code-viewer-file">
            {selected.path}
          </Text>
          <Text color="text.muted">
            {lines.length} lines{selected.language ? ` · ${selected.language}` : ''}
          </Text>
        </Flex>
        {missingTarget && (
          <Text fontSize="sm" color="text.muted">
            Couldn&apos;t find “{target?.file}” in the submission — showing {selected.path} instead.
          </Text>
        )}
        {lineWindow.truncated && (
          <Text fontSize="sm" color="text.muted" data-testid="code-viewer-truncated">
            Large file: showing lines {lineWindow.start + 1}–{lineWindow.end} of {lineWindow.total}.
          </Text>
        )}
        {highlightLine !== null && <VisuallyHidden aria-live="polite">Highlighted line {highlightLine}</VisuallyHidden>}
        <Box
          ref={highlightRef}
          role="region"
          aria-label={`Code of ${selected.path}`}
          tabIndex={0}
          maxH="65vh"
          overflow="auto"
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="lg"
          py={2}
          fontFamily="mono"
          fontSize={{ base: 'xs', md: 'sm' }}
          lineHeight="1.6"
        >
          <Box minW="fit-content">
            {lines.slice(lineWindow.start, lineWindow.end).map((text, index) => {
              const number = lineWindow.start + index + 1;
              return <CodeLine key={number} number={number} text={text} highlighted={number === highlightLine} />;
            })}
          </Box>
        </Box>
      </Stack>
    </Flex>
  );
}

export default CodeViewer;
