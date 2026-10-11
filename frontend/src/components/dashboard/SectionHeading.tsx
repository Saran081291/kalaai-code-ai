import { Flex, Heading, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export interface SectionHeadingProps {
  /** Heading element id (for `aria-labelledby` on the section). */
  id?: string;
  title: string;
  subtitle?: string;
  /** Optional "see all" style link on the right. */
  linkTo?: string;
  linkLabel?: string;
}

export function SectionHeading({ id, title, subtitle, linkTo, linkLabel }: SectionHeadingProps) {
  return (
    <Flex align="flex-end" justify="space-between" gap={3} mb={4} wrap="wrap">
      <div>
        <Heading as="h2" size="md" id={id}>
          {title}
        </Heading>
        {subtitle && (
          <Text fontSize="sm" color="text.muted" mt={1}>
            {subtitle}
          </Text>
        )}
      </div>
      {linkTo && linkLabel && (
        <Link as={RouterLink} to={linkTo} fontSize="sm" fontWeight={600} color="text.accent">
          {linkLabel}
        </Link>
      )}
    </Flex>
  );
}

export default SectionHeading;
