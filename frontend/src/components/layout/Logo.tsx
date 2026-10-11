import { Link, Text, type LinkProps } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export type LogoProps = Omit<LinkProps, 'href'> & {
  to?: string;
};

/** "Kalaai Code 🔥" wordmark. */
export function Logo({ to = '/', fontSize = '2xl', ...rest }: LogoProps) {
  return (
    <Link
      as={RouterLink}
      to={to}
      fontFamily="heading"
      fontWeight={800}
      fontSize={fontSize}
      lineHeight={1}
      whiteSpace="nowrap"
      _hover={{ textDecoration: 'none', opacity: 0.85 }}
      {...rest}
    >
      <Text
        as="span"
        bgGradient="linear(to-r, brand.500, maroon.500)"
        _dark={{ bgGradient: 'linear(to-r, brand.300, maroon.200)' }}
        bgClip="text"
      >
        Kalaai Code
      </Text>{' '}
      <span aria-hidden>🔥</span>
    </Link>
  );
}

export default Logo;
