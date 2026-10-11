import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

/**
 * "Madurai" theme — temple-gopuram orange, Meenakshi maroon, jasmine (malli) white, Jigarthanda brown.
 *
 * Usage cheatsheet:
 *  - Palettes (50–900): brand, maroon, jasmine, jigarthanda  → colorScheme="brand" etc.
 *  - Spice colors: spice.mild | spice.mildYellow | spice.medium | spice.mass
 *  - Semantic tokens (light/dark aware): bg.canvas, bg.surface, bg.subtle, bg.glass, bg.muted,
 *    text.primary, text.muted, text.accent, text.onBrand, border.subtle, border.strong,
 *    accent.primary, accent.secondary
 *  - Button variant "brand" (orange → maroon gradient pill); Card variant "glass".
 */

const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: false,
};

const colors = {
  /** Temple orange — base #E86A17 at 500 */
  brand: {
    50: '#FFF3E8',
    100: '#FFDFC2',
    200: '#FBC08F',
    300: '#F6A05C',
    400: '#F0853A',
    500: '#E86A17',
    600: '#C85711',
    700: '#A0440E',
    800: '#78330B',
    900: '#502207',
  },
  /** Deep maroon — base #7A1F2B at 500 */
  maroon: {
    50: '#FBEBED',
    100: '#F2C9CE',
    200: '#E39BA4',
    300: '#CF6B78',
    400: '#A93D4B',
    500: '#7A1F2B',
    600: '#661A24',
    700: '#51151D',
    800: '#3D1016',
    900: '#290A0F',
  },
  /** Jasmine (malli) off-white — base #FFF8EC at 100 */
  jasmine: {
    50: '#FFFCF6',
    100: '#FFF8EC',
    200: '#FDF0D8',
    300: '#F9E4BC',
    400: '#F3D49A',
    500: '#EBC277',
    600: '#D4A656',
    700: '#A9823F',
    800: '#7D5F2D',
    900: '#523E1D',
  },
  /** Jigarthanda brown — base #6B4226 at 500 */
  jigarthanda: {
    50: '#F6EFEA',
    100: '#E8D7CB',
    200: '#D2B39E',
    300: '#B88D71',
    400: '#94674A',
    500: '#6B4226',
    600: '#5A371F',
    700: '#472B19',
    800: '#352012',
    900: '#23150C',
  },
  spice: {
    mild: '#43A047',
    mildYellow: '#F2C94C',
    medium: '#F2994A',
    mass: '#D7263D',
  },
};

const semanticTokens = {
  colors: {
    bg: {
      canvas: { default: 'jasmine.50', _dark: '#16100D' },
      surface: { default: 'white', _dark: '#211814' },
      subtle: { default: 'jasmine.100', _dark: '#2B201A' },
      muted: { default: 'jasmine.200', _dark: '#35281F' },
      glass: { default: 'rgba(255, 255, 255, 0.72)', _dark: 'rgba(33, 24, 20, 0.72)' },
    },
    text: {
      primary: { default: 'jigarthanda.900', _dark: 'jasmine.50' },
      muted: { default: 'jigarthanda.500', _dark: 'jigarthanda.200' },
      accent: { default: 'brand.600', _dark: 'brand.300' },
      onBrand: { default: 'white', _dark: 'white' },
    },
    border: {
      subtle: { default: 'jasmine.300', _dark: 'whiteAlpha.200' },
      strong: { default: 'jigarthanda.200', _dark: 'whiteAlpha.400' },
    },
    accent: {
      primary: { default: 'brand.500', _dark: 'brand.400' },
      secondary: { default: 'maroon.500', _dark: 'maroon.300' },
    },
  },
};

const fonts = {
  heading: `'Baloo Thambi 2', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
  body: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  mono: `'JetBrains Mono', 'Fira Code', SFMono-Regular, Menlo, Consolas, monospace`,
};

const styles = {
  global: {
    'html, body': {
      bg: 'bg.canvas',
      color: 'text.primary',
    },
    '::selection': {
      bg: 'brand.200',
      color: 'jigarthanda.900',
    },
  },
};

const brandGradient = 'linear(to-r, brand.500, maroon.500)';

const components = {
  Button: {
    baseStyle: {
      fontWeight: 600,
      borderRadius: 'xl',
    },
    variants: {
      /** Gradient pill — the primary CTA style (used by GradientButton). */
      brand: {
        bgGradient: brandGradient,
        color: 'white',
        borderRadius: 'full',
        boxShadow: 'md',
        _hover: {
          bgGradient: 'linear(to-r, brand.600, maroon.600)',
          boxShadow: 'lg',
          _disabled: { bgGradient: brandGradient, boxShadow: 'none' },
        },
        _active: { bgGradient: 'linear(to-r, brand.700, maroon.700)' },
        _focusVisible: { boxShadow: '0 0 0 3px var(--chakra-colors-brand-200)' },
      },
    },
    defaultProps: {
      colorScheme: 'brand',
    },
  },
  Card: {
    baseStyle: {
      container: {
        '--card-bg': 'colors.bg.surface',
        borderRadius: '2xl',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        transitionProperty: 'common',
        transitionDuration: 'normal',
      },
    },
    variants: {
      glass: {
        container: {
          '--card-bg': 'colors.bg.glass',
          backdropFilter: 'blur(12px)',
          boxShadow: 'lg',
        },
      },
    },
  },
  Heading: {
    baseStyle: {
      fontWeight: 700,
      letterSpacing: 'tight',
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: 'md',
      textTransform: 'none',
      fontWeight: 600,
      px: 2,
    },
  },
  Tabs: {
    defaultProps: { colorScheme: 'brand' },
  },
  Progress: {
    defaultProps: { colorScheme: 'brand' },
  },
  Switch: {
    defaultProps: { colorScheme: 'brand' },
  },
  Checkbox: {
    defaultProps: { colorScheme: 'brand' },
  },
  Radio: {
    defaultProps: { colorScheme: 'brand' },
  },
  Input: {
    defaultProps: { focusBorderColor: 'brand.400' },
  },
  Textarea: {
    defaultProps: { focusBorderColor: 'brand.400' },
  },
  Select: {
    defaultProps: { focusBorderColor: 'brand.400' },
  },
};

export const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts,
  styles,
  components,
  radii: {
    card: '1.25rem',
  },
  shadows: {
    glow: '0 0 0 1px rgba(232, 106, 23, 0.25), 0 10px 30px -10px rgba(232, 106, 23, 0.45)',
  },
});

export default theme;
