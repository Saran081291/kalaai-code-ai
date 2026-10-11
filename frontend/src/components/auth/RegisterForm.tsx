import { Alert, AlertDescription, AlertIcon, Box, Link, Progress, Stack, Text } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { AnimatedInput } from '@/components/ui/AnimatedInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';
import { getErrorCode, getErrorMessage } from '@/services/api';
import type { RegisterableRole, User } from '@/types';

import { PasswordField } from './PasswordField';
import { RoleSelector } from './RoleSelector';
import {
  getPasswordStrength,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateFullName,
  validateNewPassword,
} from './validation';

interface RegisterErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
}

export interface RegisterFormProps {
  /** Called after the account is created and the user is signed in. */
  onSuccess: (user: User) => void;
  /** Preselect a role (e.g. from `?role=instructor`). */
  initialRole?: RegisterableRole | null;
}

const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists.';

/** Sign-up form: name, email, password (+confirm), role. */
export function RegisterForm({ onSuccess, initialRole = null }: RegisterFormProps) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterableRole | null>(initialRole);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = getPasswordStrength(password);

  const validate = (): RegisterErrors => ({
    fullName: validateFullName(fullName, true),
    email: validateEmail(email),
    password: validateNewPassword(password),
    confirmPassword: !confirmPassword
      ? 'Please confirm your password.'
      : confirmPassword !== password
        ? 'Passwords do not match.'
        : undefined,
    role: role ? undefined : 'Please choose a role — Student or Instructor.',
  });

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError(null);
    setEmailTaken(false);
    if (Object.values(nextErrors).some(Boolean) || !role) return;

    setIsSubmitting(true);
    try {
      const user = await register({ fullName: fullName.trim(), email: email.trim(), password, role });
      onSuccess(user);
    } catch (err) {
      if (getErrorCode(err) === 'EMAIL_TAKEN') {
        setEmailTaken(true);
        setErrors((prev) => ({ ...prev, email: EMAIL_TAKEN_MESSAGE }));
        setSubmitError(EMAIL_TAKEN_MESSAGE);
      } else {
        setSubmitError(getErrorMessage(err));
      }
      setIsSubmitting(false);
    }
  };

  return (
    <Stack as="form" spacing={4} noValidate onSubmit={(event) => void handleSubmit(event)} aria-label="Register form">
      {submitError && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>
            {submitError}{' '}
            {emailTaken && (
              <Link as={RouterLink} to={ROUTES.login} fontWeight={600} color="text.accent">
                Login pannunga?
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      <AnimatedInput
        label="Full name"
        name="fullName"
        autoComplete="name"
        placeholder="Thambi Kumar"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={errors.fullName}
        isRequired
        isDisabled={isSubmitting}
      />
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
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        helperText={`At least ${PASSWORD_MIN_LENGTH} characters. Mix letters, numbers and symbols.`}
        isRequired
        isDisabled={isSubmitting}
        footer={
          password ? (
            <Box mt={2} aria-live="polite">
              <Progress
                value={strength.score * 25}
                size="xs"
                borderRadius="full"
                colorScheme={strength.colorScheme}
                bg="bg.muted"
                aria-label="Password strength"
              />
              <Text fontSize="xs" color="text.muted" mt={1}>
                Strength: {strength.label}
              </Text>
            </Box>
          ) : null
        }
      />
      <PasswordField
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={errors.confirmPassword}
        isRequired
        isDisabled={isSubmitting}
      />
      <RoleSelector
        value={role}
        onChange={(next) => {
          setRole(next);
          setErrors((prev) => ({ ...prev, role: undefined }));
        }}
        error={errors.role}
        isDisabled={isSubmitting}
      />
      <GradientButton type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Creating account…">
        Create account
      </GradientButton>
    </Stack>
  );
}

export default RegisterForm;
