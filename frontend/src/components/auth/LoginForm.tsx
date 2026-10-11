import { Alert, AlertDescription, AlertIcon, Stack } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';

import { AnimatedInput } from '@/components/ui/AnimatedInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { useAuth } from '@/hooks/useAuth';
import { getErrorCode, getErrorMessage, getErrorStatus } from '@/services/api';
import type { User } from '@/types';

import { PasswordField } from './PasswordField';
import { validateEmail, validateLoginPassword } from './validation';

interface LoginErrors {
  email?: string;
  password?: string;
}

export interface LoginFormProps {
  /** Called after a successful login (e.g. navigate to the redirect target). */
  onSuccess: (user: User) => void;
}

function loginErrorMessage(err: unknown): string {
  if (getErrorCode(err) === 'INVALID_CREDENTIALS') {
    return 'Email or password thappu. Please check and try again.';
  }
  if (getErrorStatus(err) === 429) {
    return 'Too many login attempts. Please wait a minute and try again.';
  }
  return getErrorMessage(err);
}

/** Email + password login form. */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const nextErrors: LoginErrors = {
      email: validateEmail(email),
      password: validateLoginPassword(password),
    };
    setErrors(nextErrors);
    setSubmitError(null);
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      onSuccess(user);
    } catch (err) {
      setSubmitError(loginErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <Stack as="form" spacing={4} noValidate onSubmit={(event) => void handleSubmit(event)} aria-label="Login form">
      {submitError && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <AnimatedInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="thambi@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        isRequired
        isDisabled={isSubmitting}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        isRequired
        isDisabled={isSubmitting}
      />
      <GradientButton type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Logging in…">
        Login
      </GradientButton>
    </Stack>
  );
}

export default LoginForm;
