import { Alert, AlertDescription, AlertIcon, FormControl, FormLabel, Stack, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';

import { AnimatedInput } from '@/components/ui/AnimatedInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/services/api';
import type { SpiceLevel, UpdateProfileRequest, User } from '@/types';

import { SpiceLevelSelector } from './SpiceLevelSelector';
import { FULL_NAME_MAX_LENGTH, validateFullName, validateOptionalUrl } from './validation';

interface ProfileErrors {
  fullName?: string;
  avatarUrl?: string;
}

export interface ProfileFormProps {
  user: User;
}

/** Edit full name, avatar URL and default spice level (PUT /auth/me). */
export function ProfileForm({ user }: ProfileFormProps) {
  const { updateProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(user.defaultSpiceLevel);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const nextErrors: ProfileErrors = {
      fullName: validateFullName(fullName, false),
      avatarUrl: validateOptionalUrl(avatarUrl),
    };
    setErrors(nextErrors);
    setSubmitError(null);
    if (nextErrors.fullName || nextErrors.avatarUrl) return;

    const body: UpdateProfileRequest = {
      fullName: fullName.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      defaultSpiceLevel: spiceLevel,
    };

    setIsSaving(true);
    try {
      await updateProfile(body);
      toast({ status: 'success', title: 'Semma! Profile update aachu 🎉', duration: 3000, isClosable: true });
    } catch (err) {
      const message = getErrorMessage(err);
      setSubmitError(message);
      toast({ status: 'error', title: 'Profile update failed', description: message, isClosable: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack as="form" spacing={5} noValidate onSubmit={(event) => void handleSubmit(event)} aria-label="Edit profile">
      {submitError && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <AnimatedInput
        label="Full name"
        name="fullName"
        autoComplete="name"
        maxLength={FULL_NAME_MAX_LENGTH}
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={errors.fullName}
        isDisabled={isSaving}
      />
      <AnimatedInput
        label="Avatar URL"
        name="avatarUrl"
        type="url"
        inputMode="url"
        placeholder="https://example.com/me.png"
        value={avatarUrl}
        onChange={(event) => setAvatarUrl(event.target.value)}
        error={errors.avatarUrl}
        helperText="Optional. Link to a square image (http or https)."
        isDisabled={isSaving}
      />
      <FormControl as="fieldset">
        <FormLabel as="legend" fontWeight={600}>
          Default spice level
        </FormLabel>
        <SpiceLevelSelector
          value={spiceLevel}
          onChange={setSpiceLevel}
          name="defaultSpiceLevel"
          ariaLabel="Default spice level"
          isDisabled={isSaving}
        />
      </FormControl>
      <GradientButton type="submit" size="lg" isLoading={isSaving} loadingText="Saving…">
        Save changes
      </GradientButton>
    </Stack>
  );
}

export default ProfileForm;
