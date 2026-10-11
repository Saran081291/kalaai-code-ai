import {
  Avatar,
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { Suspense, type ReactNode } from 'react';
import { FiChevronDown, FiLogOut, FiMenu, FiSettings, FiUser } from 'react-icons/fi';
import { NavLink, Link as RouterLink, Outlet } from 'react-router-dom';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MotionBox } from '@/components/ui/motion';
import type { UserRole } from '@/types';

import { ColorModeToggle } from './ColorModeToggle';
import { Logo } from './Logo';
import { getNavItems, type NavItem } from './navConfig';

const SIDEBAR_WIDTH = '260px';

export interface AppShellProps {
  /** Current user's role — drives sidebar items. */
  role?: UserRole;
  userName?: string | null;
  avatarUrl?: string | null;
  onLogout?: () => void;
  /** Override nav items (defaults to navConfig for `role`). */
  navItems?: NavItem[];
  /** Rendered instead of the nested route <Outlet />. */
  children?: ReactNode;
}

interface NavListProps {
  items: NavItem[];
  onNavigate?: () => void;
}

function NavList({ items, onNavigate }: NavListProps) {
  return (
    <VStack as="nav" aria-label="Main navigation" align="stretch" spacing={1}>
      {items.map((item) => (
        <MotionBox key={item.path} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
          <Button
            as={NavLink}
            to={item.path}
            end={item.end}
            onClick={onNavigate}
            variant="ghost"
            colorScheme="gray"
            justifyContent="flex-start"
            leftIcon={<Icon as={item.icon} boxSize={5} />}
            w="full"
            h={11}
            fontWeight={500}
            color="text.muted"
            _hover={{ bg: 'bg.subtle', color: 'text.primary' }}
            _activeLink={{
              bg: 'brand.50',
              color: 'brand.600',
              fontWeight: 700,
              _dark: { bg: 'whiteAlpha.100', color: 'brand.300' },
            }}
          >
            {item.label}
          </Button>
        </MotionBox>
      ))}
    </VStack>
  );
}

function SidebarFooter() {
  return (
    <Box p={4} borderRadius="xl" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
      <Text fontSize="sm" fontWeight={600}>
        Code-a podu, roast-a vaangu 🌶️
      </Text>
      <Text fontSize="xs" color="text.muted" mt={1}>
        Rubric review + Madurai kalaai, instant-a.
      </Text>
    </Box>
  );
}

interface UserMenuProps {
  role?: UserRole;
  userName?: string | null;
  avatarUrl?: string | null;
  onLogout?: () => void;
}

function UserMenu({ role, userName, avatarUrl, onLogout }: UserMenuProps) {
  const displayName = userName ?? 'Guest';
  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        variant="ghost"
        colorScheme="gray"
        borderRadius="full"
        px={2}
        rightIcon={<FiChevronDown />}
        aria-label="User menu"
      >
        <HStack spacing={2}>
          <Avatar size="sm" name={displayName} src={avatarUrl ?? undefined} bg="maroon.500" color="white" />
          <Text display={{ base: 'none', md: 'block' }} fontWeight={600} maxW="40" noOfLines={1}>
            {displayName}
          </Text>
        </HStack>
      </MenuButton>
      <MenuList>
        {role && (
          <Box px={3} py={2}>
            <Badge colorScheme={role === 'instructor' ? 'purple' : 'brand'} textTransform="capitalize">
              {role}
            </Badge>
          </Box>
        )}
        <MenuItem as={RouterLink} to="/profile" icon={<FiUser />}>
          Profile
        </MenuItem>
        <MenuItem as={RouterLink} to="/settings" icon={<FiSettings />}>
          Settings
        </MenuItem>
        <MenuDivider />
        <MenuItem icon={<FiLogOut />} onClick={onLogout} isDisabled={!onLogout}>
          Logout
        </MenuItem>
      </MenuList>
    </Menu>
  );
}

/** Authenticated app layout: sidebar (drawer on mobile) + top bar + routed content. */
export function AppShell({ role, userName, avatarUrl, onLogout, navItems, children }: AppShellProps) {
  const drawer = useDisclosure();
  const items = navItems ?? getNavItems(role);

  return (
    <Flex minH="100vh" bg="bg.canvas">
      {/* Desktop sidebar */}
      <Flex
        as="aside"
        display={{ base: 'none', md: 'flex' }}
        direction="column"
        justify="space-between"
        w={SIDEBAR_WIDTH}
        flexShrink={0}
        h="100vh"
        position="sticky"
        top={0}
        p={5}
        gap={6}
        bg="bg.surface"
        borderRightWidth="1px"
        borderColor="border.subtle"
      >
        <VStack align="stretch" spacing={8}>
          <Box px={2} pt={1}>
            <Logo to="/dashboard" />
          </Box>
          <NavList items={items} />
        </VStack>
        <SidebarFooter />
      </Flex>

      {/* Mobile drawer */}
      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose}>
        <DrawerOverlay />
        <DrawerContent bg="bg.surface">
          <DrawerCloseButton />
          <DrawerHeader>
            <Logo to="/dashboard" onClick={drawer.onClose} />
          </DrawerHeader>
          <DrawerBody display="flex" flexDirection="column" justifyContent="space-between" pb={6}>
            <NavList items={items} onNavigate={drawer.onClose} />
            <SidebarFooter />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex direction="column" flex={1} minW={0}>
        <Flex
          as="header"
          align="center"
          justify="space-between"
          h={16}
          px={{ base: 3, md: 6 }}
          position="sticky"
          top={0}
          zIndex="sticky"
          bg="bg.glass"
          backdropFilter="blur(12px)"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <HStack spacing={2}>
            <IconButton
              display={{ base: 'inline-flex', md: 'none' }}
              aria-label="Open navigation"
              icon={<FiMenu />}
              variant="ghost"
              colorScheme="gray"
              onClick={drawer.onOpen}
            />
            <Box display={{ base: 'block', md: 'none' }}>
              <Logo to="/dashboard" fontSize="xl" />
            </Box>
          </HStack>
          <HStack spacing={1}>
            <ColorModeToggle />
            <UserMenu role={role} userName={userName} avatarUrl={avatarUrl} onLogout={onLogout} />
          </HStack>
        </Flex>

        <Box as="main" flex={1} w="full">
          <Suspense fallback={<LoadingScreen fullScreen={false} />}>{children ?? <Outlet />}</Suspense>
        </Box>
      </Flex>
    </Flex>
  );
}

export default AppShell;
