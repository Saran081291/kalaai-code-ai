import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { Suspense, type ReactNode } from 'react';
import { Link as RouterLink, Outlet } from 'react-router-dom';

import { GradientButton } from '@/components/ui/GradientButton';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MotionBox } from '@/components/ui/motion';

import { ColorModeToggle } from './ColorModeToggle';
import { Logo } from './Logo';
import { MeshBackground } from './MeshBackground';

export interface PublicLayoutProps {
  /** Rendered instead of the nested route <Outlet />. */
  children?: ReactNode;
  /** Hide Login / Get started buttons (e.g. on auth pages). */
  hideAuthActions?: boolean;
}

/** Layout for landing, login, register, OAuth callback and public roast pages. */
export function PublicLayout({ children, hideAuthActions = false }: PublicLayoutProps) {
  return (
    <Flex direction="column" minH="100vh" position="relative" isolation="isolate">
      <MeshBackground />
      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={{ base: 4, md: 8 }}
        py={4}
        position="sticky"
        top={0}
        zIndex="sticky"
        backdropFilter="blur(10px)"
      >
        <Logo />
        <HStack spacing={2}>
          <ColorModeToggle />
          {!hideAuthActions && (
            <>
              <MotionBox whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} display={{ base: 'none', sm: 'block' }}>
                <Button as={RouterLink} to="/login" variant="ghost" colorScheme="gray">
                  Login
                </Button>
              </MotionBox>
              <GradientButton to="/register" size="sm">
                Get roasted 🔥
              </GradientButton>
            </>
          )}
        </HStack>
      </Flex>

      <Box as="main" flex={1} w="full">
        <Suspense fallback={<LoadingScreen fullScreen={false} />}>{children ?? <Outlet />}</Suspense>
      </Box>

      <Box as="footer" py={6} textAlign="center">
        <Text fontSize="sm" color="text.muted">
          Made with 🌶️ and Jigarthanda — Kalaai Code © {new Date().getFullYear()}
        </Text>
      </Box>
    </Flex>
  );
}

export default PublicLayout;
