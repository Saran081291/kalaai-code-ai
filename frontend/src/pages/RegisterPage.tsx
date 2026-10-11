import { Divider, HStack, Heading, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';
import type { RegisterableRole } from '@/types';

function parseRole(value: string | null): RegisterableRole | null {
  return value === 'student' || value === 'instructor' ? value : null;
}

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  if (isAuthenticated) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <PageWrapper maxW="lg" py={{ base: 8, md: 14 }}>
      <GlassCard hoverable={false} p={{ base: 6, md: 8 }}>
        <Stack spacing={6}>
          <Stack spacing={1} textAlign="center">
            <Heading as="h1" size="lg">
              Create your account
            </Heading>
            <Text color="text.muted">Student-aa, instructor-aa? Join pannunga, kalaai start aagum 🔥</Text>
          </Stack>

          <GoogleLoginButton label="Sign up with Google" />

          <HStack spacing={3}>
            <Divider borderColor="border.subtle" />
            <Text fontSize="sm" color="text.muted" whiteSpace="nowrap">
              or with email
            </Text>
            <Divider borderColor="border.subtle" />
          </HStack>

          <RegisterForm
            initialRole={parseRole(searchParams.get('role'))}
            onSuccess={() => navigate(ROUTES.dashboard, { replace: true })}
          />

          <Text textAlign="center" fontSize="sm" color="text.muted">
            Already have an account?{' '}
            <Link as={RouterLink} to={ROUTES.login} color="text.accent" fontWeight={600}>
              Login
            </Link>
          </Text>
        </Stack>
      </GlassCard>
    </PageWrapper>
  );
}
