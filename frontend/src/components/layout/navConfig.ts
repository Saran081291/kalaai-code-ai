import type { IconType } from 'react-icons';
import { FiBookOpen, FiGrid, FiSettings, FiUploadCloud } from 'react-icons/fi';

import type { UserRole } from '@/types';

export interface NavItem {
  label: string;
  path: string;
  icon: IconType;
  /** Roles that see this item. */
  roles: readonly UserRole[];
  /** Only highlight on exact path match. */
  end?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: FiGrid, roles: ['student', 'instructor', 'admin'], end: true },
  { label: 'Courses', path: '/courses', icon: FiBookOpen, roles: ['student', 'instructor', 'admin'] },
  { label: 'My Submissions', path: '/submissions', icon: FiUploadCloud, roles: ['student'] },
  { label: 'Settings', path: '/settings', icon: FiSettings, roles: ['student', 'instructor', 'admin'], end: true },
];

/**
 * Nav items for a role. Without a role (not loaded yet) only items shared by
 * students and instructors are shown.
 */
export function getNavItems(role?: UserRole): NavItem[] {
  if (!role) {
    return NAV_ITEMS.filter((item) => item.roles.includes('student') && item.roles.includes('instructor'));
  }
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
