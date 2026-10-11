import { Avatar, Badge, Divider, Heading, SimpleGrid, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';

import { ProfileForm } from '@/components/auth/ProfileForm';
import { GlassCard } from '@/components/ui/GlassCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { SpiceChip } from '@/components/ui/SpiceChip';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

const ROLE_BADGE: Record<UserRole, { label: string; colorScheme: string }> = {
  student: { label: 'Student', colorScheme: 'brand' },
  instructor: { label: 'Instructor', colorScheme: 'maroon' },
  admin: { label: 'Admin', colorScheme: 'purple' },
};

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface DetailProps {
  label: string;
  value: string;
}

function Detail({ label, value }: DetailProps) {
  return (
    <Stack spacing={0}>
      <Text fontSize="xs" fontWeight={600} color="text.muted" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Text fontWeight={500} wordBreak="break-word">
        {value}
      </Text>
    </Stack>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return <LoadingScreen text="Profile load aagudhu…" fullScreen={false} />;
  }

  const role = ROLE_BADGE[user.role];
  const displayName = user.fullName ?? user.email;

  return (
    <PageWrapper maxW="4xl">
      <Stack spacing={6}>
        <Stack spacing={1}>
          <Heading as="h1" size="xl">
            Profile
          </Heading>
          <Text color="text.muted">Un profile-a inga set pannalaam, thambi.</Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} alignItems="start">
          <GlassCard hoverable={false}>
            <Stack spacing={4} align="center" textAlign="center">
              <Avatar size="2xl" name={displayName} src={user.avatarUrl ?? undefined} bg="brand.500" color="white" />
              <Stack spacing={1} align="center">
                <Heading as="h2" size="md" wordBreak="break-word">
                  {displayName}
                </Heading>
                <Wrap justify="center" spacing={2}>
                  <WrapItem>
                    <Badge colorScheme={role.colorScheme} borderRadius="full" px={2}>
                      {role.label}
                    </Badge>
                  </WrapItem>
                  <WrapItem>
                    <SpiceChip level={user.defaultSpiceLevel} size="sm" />
                  </WrapItem>
                </Wrap>
              </Stack>
              <Divider borderColor="border.subtle" />
              <Stack spacing={3} w="full" textAlign="left">
                <Detail label="Email" value={user.email} />
                <Detail label="Sign-in method" value={user.oauthProvider === 'google' ? 'Google' : 'Email'} />
                <Detail label="Member since" value={formatMemberSince(user.createdAt)} />
              </Stack>
            </Stack>
          </GlassCard>

          <GlassCard hoverable={false} gridColumn={{ md: 'span 2' }}>
            <Stack spacing={4}>
              <Heading as="h2" size="md">
                Edit profile
              </Heading>
              <ProfileForm key={user.id} user={user} />
            </Stack>
          </GlassCard>
        </SimpleGrid>
      </Stack>
    </PageWrapper>
  );
}
