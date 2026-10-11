import { Badge, Button, Flex, Heading, Icon, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import type { IconType } from 'react-icons';
import { FiAward, FiShield, FiUploadCloud } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { SpiceDemo } from '@/components/auth/SpiceDemo';
import { AnimatedList } from '@/components/ui/AnimatedList';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { MotionBox } from '@/components/ui/motion';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { TextReveal } from '@/components/ui/TextReveal';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';

interface Step {
  title: string;
  description: string;
  icon: IconType;
  emoji: string;
}

const STEPS: Step[] = [
  {
    title: 'Submit code',
    description: 'Paste a GitHub repo link or upload your files / zip for the assignment.',
    icon: FiUploadCloud,
    emoji: '📤',
  },
  {
    title: 'AI rubric review',
    description: "A serious, rubric-based review first: score per criterion, issues with line numbers, and fixes.",
    icon: FiAward,
    emoji: '🧑‍🏫',
  },
  {
    title: 'Madurai roast',
    description: 'Then the fun part — your code gets roasted in Madurai Tanglish at the spice level you pick.',
    icon: FiShield,
    emoji: '🌶️',
  },
];

/** Public landing page: hero, how it works, interactive spice demo. */
export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <PageWrapper maxW="5xl" py={{ base: 10, md: 20 }}>
      <Stack spacing={{ base: 14, md: 20 }}>
        {/* Hero */}
        <Stack as="section" spacing={6} align="center" textAlign="center" aria-labelledby="hero-heading">
          <MotionBox
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.4 } }}
          >
            <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1} fontSize="sm">
              AI code reviewer for student assignments
            </Badge>
          </MotionBox>
          <TextReveal
            id="hero-heading"
            text="Code review + Madurai roast 🔥"
            as="h1"
            size={{ base: '2xl', md: '4xl' }}
            lineHeight="short"
          />
          <MotionBox
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.3 } }}
          >
            <Text fontSize={{ base: 'md', md: 'xl' }} color="text.muted" maxW="2xl">
              First, a serious rubric-based review of your assignment — scores, issues and fixes. Then, a roast of your
              code in Madurai Tanglish. Assignment-a submit pannu, kalaai-ku ready-a iru! 😎
            </Text>
          </MotionBox>
          <MotionBox
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.45 } }}
          >
            {isAuthenticated ? (
              <Stack spacing={3} align="center">
                <Text color="text.muted">
                  Vaanga {user?.fullName ?? 'thambi'}, thirumba vandhuteenga! 🙌
                </Text>
                <GradientButton to={ROUTES.dashboard} size="lg">
                  Go to dashboard
                </GradientButton>
              </Stack>
            ) : (
              <Wrap justify="center" spacing={3}>
                <WrapItem>
                  <GradientButton to={ROUTES.register} size="lg">
                    Get started 🔥
                  </GradientButton>
                </WrapItem>
                <WrapItem>
                  <MotionBox whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      as={RouterLink}
                      to={ROUTES.login}
                      size="lg"
                      variant="outline"
                      borderRadius="full"
                      bg="bg.surface"
                      borderColor="border.strong"
                    >
                      Login
                    </Button>
                  </MotionBox>
                </WrapItem>
              </Wrap>
            )}
          </MotionBox>
        </Stack>

        {/* How it works */}
        <Stack as="section" spacing={6} aria-labelledby="how-heading">
          <Stack spacing={2} textAlign="center">
            <Heading id="how-heading" as="h2" size="xl">
              How it works
            </Heading>
            <Text color="text.muted">Moonu step dhaan, thambi. Simple-a irukku.</Text>
          </Stack>
          <AnimatedList columns={{ base: 1, md: 3 }} spacing={5}>
            {STEPS.map((step, index) => (
              <GlassCard key={step.title} h="full">
                <Stack spacing={3}>
                  <Flex align="center" gap={3}>
                    <Flex
                      boxSize={12}
                      align="center"
                      justify="center"
                      borderRadius="xl"
                      bg="brand.50"
                      _dark={{ bg: 'whiteAlpha.100' }}
                    >
                      <Icon as={step.icon} boxSize={6} color="accent.primary" aria-hidden />
                    </Flex>
                    <Text fontSize="sm" fontWeight={700} color="text.accent">
                      Step {index + 1}
                    </Text>
                  </Flex>
                  <Heading as="h3" size="md">
                    {step.title}{' '}
                    <Text as="span" aria-hidden>
                      {step.emoji}
                    </Text>
                  </Heading>
                  <Text color="text.muted">{step.description}</Text>
                </Stack>
              </GlassCard>
            ))}
          </AnimatedList>
        </Stack>

        {/* Spice demo */}
        <Stack as="section" spacing={6} aria-labelledby="demo-heading">
          <Stack spacing={2} textAlign="center">
            <Heading id="demo-heading" as="h2" size="xl">
              Pick your spice 🌶️
            </Heading>
            <Text color="text.muted">Mild-aa, medium-aa, illa full Madurai Mass-aa? Try pannunga.</Text>
          </Stack>
          <SpiceDemo />
        </Stack>

        <Text textAlign="center" fontSize="sm" color="text.muted" fontWeight={500}>
          Roasts target the code, never the person. Every roast ends with encouragement. 🤝
        </Text>
      </Stack>
    </PageWrapper>
  );
}
