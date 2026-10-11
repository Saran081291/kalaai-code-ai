import { Flex, Heading, Icon, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';

import { MotionBox } from './motion';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** react-icons component, e.g. FiBookOpen. */
  icon?: IconType;
  /** Emoji alternative to `icon`. */
  emoji?: string;
  /** CTA, e.g. a GradientButton. */
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, emoji, action }: EmptyStateProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.3 } }}
      borderWidth="2px"
      borderStyle="dashed"
      borderColor="border.subtle"
      borderRadius="2xl"
      bg="bg.subtle"
      px={6}
      py={12}
    >
      <Flex direction="column" align="center" textAlign="center" gap={3}>
        {icon ? (
          <Flex boxSize={14} align="center" justify="center" borderRadius="full" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }}>
            <Icon as={icon} boxSize={7} color="accent.primary" />
          </Flex>
        ) : (
          emoji && (
            <Text fontSize="4xl" aria-hidden>
              {emoji}
            </Text>
          )
        )}
        <Heading size="md">{title}</Heading>
        {description && (
          <Text color="text.muted" maxW="md">
            {description}
          </Text>
        )}
        {action && <Flex mt={2}>{action}</Flex>}
      </Flex>
    </MotionBox>
  );
}

export default EmptyState;
