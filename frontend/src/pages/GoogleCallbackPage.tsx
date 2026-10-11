import { Alert, AlertDescription, AlertIcon, AlertTitle, Heading, Stack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';

interface HashTokens {
  accessToken: string;
  refreshToken: string;
}

function firstParam(params: URLSearchParams, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

/**
 * Reads tokens from the URL fragment. Contract: `#accessToken=..&refreshToken=..`;
 * also tolerates `access_token`/`refresh_token` and the PRP's `access`/`refresh` spellings.
 */
function parseHashTokens(hash: string): HashTokens | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = firstParam(params, ['accessToken', 'access_token', 'access']);
  const refreshToken = firstParam(params, ['refreshToken', 'refresh_token', 'refresh']);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

/** Remove the fragment (tokens) from the address bar and history. */
function clearHash(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
}

export default function GoogleCallbackPage() {
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // React StrictMode runs effects twice in dev — tokens must only be consumed once.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const tokens = parseHashTokens(window.location.hash);
    const hashError = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error');
    const queryError = new URLSearchParams(window.location.search).get('error');
    clearHash();

    if (!tokens) {
      setError(
        hashError || queryError
          ? 'Google login failed. Please try again.'
          : 'Google login did not return a session. Please try again.',
      );
      return;
    }

    loginWithTokens(tokens)
      .then(() => navigate(ROUTES.dashboard, { replace: true }))
      .catch((err: unknown) => setError(getErrorMessage(err, 'Google login failed. Please try again.')));
  }, [loginWithTokens, navigate]);

  if (!error) {
    return (
      <PageWrapper>
        <LoadingScreen text="Google-oda pesitu irukkom… oru nimisham 🙏" fullScreen={false} />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper maxW="md" py={{ base: 10, md: 16 }}>
      <GlassCard hoverable={false}>
        <Stack spacing={5}>
          <Heading as="h1" size="lg">
            Login aagala 😕
          </Heading>
          <Alert status="error" borderRadius="xl" alignItems="flex-start">
            <AlertIcon />
            <Stack spacing={1}>
              <AlertTitle>Google sign-in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Stack>
          </Alert>
          <GradientButton to={ROUTES.login} fullWidth>
            Back to login
          </GradientButton>
        </Stack>
      </GlassCard>
    </PageWrapper>
  );
}
