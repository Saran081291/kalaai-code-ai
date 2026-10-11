import type { SpiceLevel } from '@/types';

export interface SpiceMeta {
  label: string;
  chilies: number;
  emoji: string;
  /** Chakra colorScheme for Badge/Tag. */
  colorScheme: 'green' | 'orange' | 'red';
  /** Theme color token (see theme `colors.spice`). */
  color: string;
  tagline: string;
}

export const SPICE_META: Record<SpiceLevel, SpiceMeta> = {
  mild: {
    label: 'Mild',
    chilies: 1,
    emoji: '🌶️',
    colorScheme: 'green',
    color: 'spice.mild',
    tagline: 'Gentle-a kalaai pannuvom 🙂',
  },
  medium: {
    label: 'Medium',
    chilies: 2,
    emoji: '🌶️🌶️',
    colorScheme: 'orange',
    color: 'spice.medium',
    tagline: 'Proper kalaai, thambi 😏',
  },
  mass: {
    label: 'Madurai Mass',
    chilies: 3,
    emoji: '🌶️🌶️🌶️',
    colorScheme: 'red',
    color: 'spice.mass',
    tagline: 'Full Madurai mass dialogue 🔥',
  },
};
