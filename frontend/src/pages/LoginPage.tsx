import { Alert, AlertDescription, AlertIcon, Divider, HStack, Heading, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { LoginForm } from '@/components/auth/LoginForm';
import { getRedirectTarget } from '@/components/auth/validation';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: 'Google login failed. Please try again or use email and password.',
  oauth_cancelled: 'Google login was cancelled.',
  account_disabled: 'Account disabled — please contact your instructor.',
};

function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return OAUTH_ERRORS[code] ?? 'Login failed. Please try again.';
}

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectTo = getRedirectTarget(location.state);
  const oauthError = oauthErrorMessage(searchParams.get('error'));

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <PageWrapper maxW="md" py={{ base: 8, md: 14 }}>
      <GlassCard hoverable={false} p={{ base: 6, md: 8 }}>
        <Stack spacing={6}>
          <Stack spacing={1} textAlign="center">
            <Heading as="h1" size="lg">
              Vaanga, login pannunga 👋
            </Heading>
            <Text color="text.muted">Thirumba vandhuteenga! Login to see your reviews and roasts.</Text>
          </Stack>

          {oauthError && (
            <Alert status="error" borderRadius="xl">
              <AlertIcon />
              <AlertDescription>{oauthError}</AlertDescription>
            </Alert>
          )}

          <GoogleLoginButton />

          <HStack spacing={3}>
            <Divider borderColor="border.subtle" />
            <Text fontSize="sm" color="text.muted" whiteSpace="nowrap">
              or with email
            </Text>
            <Divider borderColor="border.subtle" />
          </HStack>

          <LoginForm onSuccess={() => navigate(redirectTo, { replace: true })} />

          <Text textAlign="center" fontSize="sm" color="text.muted">
            New here?{' '}
            <Link as={RouterLink} to={ROUTES.register} color="text.accent" fontWeight={600}>
              Create an account
            </Link>
          </Text>
        </Stack>
      </GlassCard>
    </PageWrapper>
  );
}
