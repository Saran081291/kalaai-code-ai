import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  List,
  ListItem,
  Stack,
  Text,
  VisuallyHiddenInput,
} from '@chakra-ui/react';
import { useId, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { FiArchive, FiFileText, FiUploadCloud, FiX } from 'react-icons/fi';

import { MotionBox } from '@/components/ui/motion';

import {
  formatBytes,
  isZip,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_MB,
  UPLOAD_ACCEPT,
  validateUploadFiles,
} from './uploadRules';

export interface FileDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  isDisabled?: boolean;
}

/** Merge new files into the selection; a re-added file name replaces the old one. */
function mergeFiles(current: File[], added: File[]): File[] {
  const byName = new Map(current.map((file) => [file.name, file]));
  added.forEach((file) => byName.set(file.name, file));
  return Array.from(byName.values());
}

/** Drag-and-drop + click-to-browse file picker with a removable file list and client-side validation. */
export function FileDropzone({ files, onFilesChange, isDisabled = false }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hintId = useId();
  const errorsId = useId();

  const errors = validateUploadFiles(files);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0 || isDisabled) return;
    onFilesChange(mergeFiles(files, Array.from(list)));
  };

  const openPicker = () => {
    if (!isDisabled) inputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDisabled) setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files);
    // Allow picking the same file again after removing it.
    event.target.value = '';
  };

  const removeFile = (name: string) => {
    onFilesChange(files.filter((file) => file.name !== name));
  };

  return (
    <Stack spacing={4}>
      <MotionBox
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-disabled={isDisabled}
        aria-label="Upload files: drop files here or press Enter to browse"
        aria-describedby={errors.length > 0 ? `${hintId} ${errorsId}` : hintId}
        data-testid="file-dropzone"
        data-dragging={isDragging || undefined}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={isDisabled ? undefined : { scale: 1.01 }}
        whileTap={isDisabled ? undefined : { scale: 0.99 }}
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={isDragging ? 'accent.primary' : 'border.strong'}
        bg={isDragging ? 'bg.muted' : 'bg.subtle'}
        borderRadius="2xl"
        px={6}
        py={10}
        textAlign="center"
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
        opacity={isDisabled ? 0.6 : 1}
        _focusVisible={{ outline: 'none', boxShadow: 'outline' }}
      >
        <Flex direction="column" align="center" gap={2}>
          <Icon as={FiUploadCloud} boxSize={10} color="accent.primary" aria-hidden />
          <Text fontWeight={600}>
            {isDragging ? 'Drop pannunga! 📥' : 'Drag & drop your code files here, or click to browse'}
          </Text>
          <Text id={hintId} fontSize="sm" color="text.muted">
            Code files or one .zip · up to {MAX_UPLOAD_FILES} files · {MAX_UPLOAD_MB} MB total
          </Text>
        </Flex>
      </MotionBox>

      <VisuallyHiddenInput
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        onChange={handleInputChange}
        disabled={isDisabled}
        aria-label="Choose files to upload"
        data-testid="file-input"
        tabIndex={-1}
      />

      {errors.length > 0 && (
        <Alert status="error" borderRadius="xl" alignItems="start" id={errorsId} role="alert">
          <AlertIcon />
          <AlertDescription>
            <List spacing={1}>
              {errors.map((message) => (
                <ListItem key={message}>{message}</ListItem>
              ))}
            </List>
          </AlertDescription>
        </Alert>
      )}

      {files.length > 0 && (
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight={600}>
              {files.length} {files.length === 1 ? 'file' : 'files'} selected
            </Text>
            <Text fontSize="sm" color="text.muted">
              {formatBytes(totalBytes)} / {MAX_UPLOAD_MB} MB
            </Text>
          </HStack>
          <List
            spacing={2}
            maxH="280px"
            overflowY="auto"
            aria-label="Selected files"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="xl"
            p={2}
            bg="bg.surface"
          >
            {files.map((file) => (
              <ListItem key={file.name}>
                <HStack spacing={3} px={2} py={1} borderRadius="lg" _hover={{ bg: 'bg.subtle' }}>
                  <Icon as={isZip(file) ? FiArchive : FiFileText} color="text.muted" aria-hidden />
                  <Text flex="1" minW={0} fontSize="sm" fontFamily="mono" noOfLines={1} title={file.name}>
                    {file.name}
                  </Text>
                  <Text fontSize="xs" color="text.muted" flexShrink={0}>
                    {formatBytes(file.size)}
                  </Text>
                  <IconButton
                    aria-label={`Remove ${file.name}`}
                    icon={<FiX />}
                    size="xs"
                    variant="ghost"
                    onClick={() => removeFile(file.name)}
                    isDisabled={isDisabled}
                  />
                </HStack>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Stack>
  );
}

export default FileDropzone;
