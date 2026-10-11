import { Alert, AlertIcon, Badge, Divider, Flex, Skeleton, Stack, useToast } from '@chakra-ui/react';

import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { useRegenerateRoast, useSetRoastHidden, useSetRoastShared } from '@/hooks/useReview';
import { getErrorCode, getErrorMessage } from '@/services/api';
import type { Roast, SpiceLevel } from '@/types';

import { HideRoastToggle } from './HideRoastToggle';
import { RegenerateButton } from './RegenerateButton';
import { RoastReveal } from './RoastReveal';
import { ShareToggle } from './ShareToggle';

export interface RoastTabProps {
  submissionId: number;
  /** `null` → not ready / not available (hidden roasts 404 for students). */
  roast: Roast | null | undefined;
  isLoading: boolean;
  error: unknown;
  isOwner: boolean;
  isInstructor: boolean;
}

/** The Madurai roast + owner (regenerate, share) and instructor (hide) actions. */
export function RoastTab({ submissionId, roast, isLoading, error, isOwner, isInstructor }: RoastTabProps) {
  const toast = useToast();
  const regenerate = useRegenerateRoast(submissionId);
  const setHidden = useSetRoastHidden(submissionId);
  const setShared = useSetRoastShared(submissionId);

  if (isLoading) {
    return (
      <GlassCard hoverable={false} aria-busy="true" aria-label="Loading roast">
        <Stack spacing={4}>
          <Skeleton h="28px" w="40%" />
          <Skeleton h="56px" />
          <Skeleton h="140px" />
        </Stack>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="xl">
        <AlertIcon />
        {getErrorMessage(error, 'Could not load the roast.')}
      </Alert>
    );
  }

  if (!roast) {
    return (
      <EmptyState
        emoji="🫙"
        title="Roast not available"
        description="Indha roast ippo available illa. The review tab still has your full feedback 📋"
      />
    );
  }

  const handleRegenerate = (spiceLevel?: SpiceLevel) => {
    regenerate.mutate(
      { roastId: roast.id, spiceLevel },
      {
        onSuccess: () => toast({ status: 'success', title: 'Pudhu roast ready! 🔥' }),
        onError: (err) =>
          toast({
            status: 'error',
            title:
              getErrorCode(err) === 'REGENERATE_LIMIT'
                ? 'Regenerate limit reached'
                : 'Could not regenerate the roast',
            description:
              getErrorCode(err) === 'REGENERATE_LIMIT'
                ? `You can regenerate a roast only twice. ${getErrorMessage(err)}`
                : getErrorMessage(err),
          }),
      },
    );
  };

  const handleShare = (isShared: boolean) => {
    setShared.mutate(
      { roastId: roast.id, isShared },
      {
        onSuccess: () =>
          toast({
            status: 'success',
            title: isShared ? 'Roast Wall-la potaachu! 🎉' : 'Roast removed from the wall',
          }),
        onError: (err) => toast({ status: 'error', title: 'Could not update sharing', description: getErrorMessage(err) }),
      },
    );
  };

  const handleHide = (isHidden: boolean) => {
    setHidden.mutate(
      { roastId: roast.id, isHidden },
      {
        onSuccess: () => toast({ status: 'success', title: isHidden ? 'Roast hidden' : 'Roast visible again' }),
        onError: (err) => toast({ status: 'error', title: 'Could not update visibility', description: getErrorMessage(err) }),
      },
    );
  };

  const showOwnerActions = isOwner;
  const showInstructorActions = isInstructor;

  return (
    <Stack spacing={6}>
      <GlassCard hoverable={false} p={{ base: 5, md: 8 }}>
        {(roast.isHidden || roast.isShared || roast.regenerateCount > 0) && (
          <Flex gap={2} mb={4} flexWrap="wrap">
            {roast.isHidden && <Badge colorScheme="red">Hidden from student</Badge>}
            {roast.isShared && <Badge colorScheme="green">On the Roast Wall</Badge>}
            {roast.regenerateCount > 0 && <Badge variant="outline">Regenerated ×{roast.regenerateCount}</Badge>}
          </Flex>
        )}
        <RoastReveal key={`${roast.id}-${roast.regenerateCount}-${roast.updatedAt}`} roast={roast} />
      </GlassCard>

      {(showOwnerActions || showInstructorActions) && (
        <GlassCard hoverable={false} p={{ base: 4, md: 6 }}>
          <Stack spacing={5} divider={<Divider borderColor="border.subtle" />}>
            {showOwnerActions && (
              <RegenerateButton
                regenerateCount={roast.regenerateCount}
                currentSpice={roast.spiceLevel}
                onRegenerate={handleRegenerate}
                isLoading={regenerate.isPending}
              />
            )}
            {showOwnerActions && <ShareToggle roast={roast} onToggle={handleShare} isLoading={setShared.isPending} />}
            {showInstructorActions && (
              <HideRoastToggle isHidden={roast.isHidden} onToggle={handleHide} isLoading={setHidden.isPending} />
            )}
          </Stack>
        </GlassCard>
      )}
    </Stack>
  );
}

export default RoastTab;
