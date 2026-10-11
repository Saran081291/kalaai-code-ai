import {
  Avatar,
  Button,
  Flex,
  Heading,
  HStack,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useColorMode,
  useToast,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { FiLogOut, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { DefaultSpiceSelector } from '@/components/dashboard/DefaultSpiceSelector';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';
import type { SpiceLevel } from '@/types';

type ColorModeChoice = 'light' | 'dark';

function isColorModeChoice(value: string): value is ColorModeChoice {
  return value === 'light' || value === 'dark';
}

interface SettingsSectionProps {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}

function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  return (
    <GlassCard as="section" aria-labelledby={id} hoverable={false}>
      <Heading as="h2" size="md" id={id}>
        {title}
      </Heading>
      <Text color="text.muted" fontSize="sm" mt={1} mb={5}>
        {description}
      </Text>
      {children}
    </GlassCard>
  );
}

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const { colorMode, setColorMode } = useColorMode();
  const navigate = useNavigate();
  const toast = useToast();

  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(user?.defaultSpiceLevel ?? 'medium');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const spiceMutation = useMutation({
    mutationFn: (level: SpiceLevel) => updateProfile({ defaultSpiceLevel: level }),
    onMutate: (level) => {
      const previous = spiceLevel;
      setSpiceLevel(level);
      return { previous };
    },
    onSuccess: (updated) => {
      setSpiceLevel(updated.defaultSpiceLevel);
      toast({ status: 'success', title: 'Spice level save aachu 🌶️', duration: 3000, isClosable: true });
    },
    onError: (err, _level, context) => {
      if (context) setSpiceLevel(context.previous);
      toast({
        status: 'error',
        title: 'Could not save spice level',
        description: getErrorMessage(err),
        duration: 5000,
        isClosable: true,
      });
    },
  });

  const handleSpiceChange = (level: SpiceLevel) => {
    if (level === spiceLevel || spiceMutation.isPending) return;
    spiceMutation.mutate(level);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate(ROUTES.login, { replace: true });
    } catch (err) {
      setIsLoggingOut(false);
      toast({ status: 'error', title: 'Logout failed', description: getErrorMessage(err), isClosable: true });
    }
  };

  return (
    <PageWrapper maxW="4xl">
      <Heading as="h1" size={{ base: 'lg', md: 'xl' }} mb={2}>
        Settings
      </Heading>
      <Text color="text.muted" mb={8}>
        Spice level, theme ellam inga maathikalaam 🌶️
      </Text>

      <Stack spacing={6}>
        <SettingsSection
          id="settings-roast"
          title="Roast preferences"
          description="Default spice level for new submissions. Neenga evlo kaaram thaanguveenga?"
        >
          <DefaultSpiceSelector value={spiceLevel} onChange={handleSpiceChange} isDisabled={spiceMutation.isPending} />
        </SettingsSection>

        <SettingsSection id="settings-appearance" title="Appearance" description="Light-a dark-a — unga choice.">
          <RadioGroup
            value={colorMode}
            onChange={(next) => {
              if (isColorModeChoice(next)) setColorMode(next);
            }}
            aria-label="Color mode"
          >
            <HStack spacing={6}>
              <Radio value="light">
                <HStack spacing={2}>
                  <FiSun aria-hidden />
                  <Text>Light</Text>
                </HStack>
              </Radio>
              <Radio value="dark">
                <HStack spacing={2}>
                  <FiMoon aria-hidden />
                  <Text>Dark</Text>
                </HStack>
              </Radio>
            </HStack>
          </RadioGroup>
        </SettingsSection>

        <SettingsSection id="settings-account" title="Account" description="Profile details and session.">
          <Flex direction={{ base: 'column', sm: 'row' }} align={{ base: 'flex-start', sm: 'center' }} gap={4}>
            <HStack spacing={3} flex={1} minW={0}>
              <Avatar size="md" name={user?.fullName ?? user?.email} src={user?.avatarUrl ?? undefined} />
              <Stack spacing={0} minW={0}>
                <Text fontWeight={700} noOfLines={1}>
                  {user?.fullName ?? 'No name set'}
                </Text>
                <Text fontSize="sm" color="text.muted" noOfLines={1}>
                  {user?.email}
                </Text>
              </Stack>
            </HStack>
            <HStack spacing={3}>
              <Button as={RouterLink} to={ROUTES.profile} leftIcon={<FiUser />} variant="outline" size="sm">
                Edit profile
              </Button>
              <Button
                leftIcon={<FiLogOut />}
                colorScheme="red"
                variant="ghost"
                size="sm"
                onClick={() => void handleLogout()}
                isLoading={isLoggingOut}
                loadingText="Logging out"
              >
                Logout
              </Button>
            </HStack>
          </Flex>
        </SettingsSection>
      </Stack>
    </PageWrapper>
  );
}
