import { Box, Heading, HStack, Icon, Text } from '@chakra-ui/react';
import { FiCheckCircle } from 'react-icons/fi';

import { AnimatedList } from '@/components/ui/AnimatedList';

export interface StrengthsListProps {
  strengths: string[];
}

/** What the student did well. */
export function StrengthsList({ strengths }: StrengthsListProps) {
  return (
    <Box as="section" aria-labelledby="strengths-heading">
      <Heading id="strengths-heading" as="h3" size="md" mb={3}>
        Strengths 💪
      </Heading>
      {strengths.length === 0 ? (
        <Text color="text.muted">No strengths listed this time — next attempt-la kalakkunga!</Text>
      ) : (
        <AnimatedList spacing={2} stagger={0.05}>
          {strengths.map((strength, index) => (
            <HStack
              key={`${index}-${strength}`}
              align="flex-start"
              spacing={3}
              bg="bg.subtle"
              borderRadius="lg"
              px={3}
              py={2}
            >
              <Icon as={FiCheckCircle} color="green.400" mt={1} aria-hidden />
              <Text whiteSpace="pre-wrap">{strength}</Text>
            </HStack>
          ))}
        </AnimatedList>
      )}
    </Box>
  );
}

export default StrengthsList;
