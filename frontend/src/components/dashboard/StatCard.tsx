import { Flex, Icon, Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';
import type { IconType } from 'react-icons';

import { GlassCard } from '@/components/ui/GlassCard';

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: IconType;
  helpText?: string;
}

/** Single KPI tile used in the dashboard stat rows. */
export function StatCard({ label, value, icon, helpText }: StatCardProps) {
  return (
    <GlassCard p={5} h="full">
      <Flex align="center" justify="space-between" gap={3}>
        <Stat>
          <StatLabel color="text.muted" fontWeight={600}>
            {label}
          </StatLabel>
          <StatNumber fontFamily="heading" fontSize="3xl" color="text.primary">
            {value}
          </StatNumber>
          {helpText && (
            <StatHelpText mb={0} color="text.muted">
              {helpText}
            </StatHelpText>
          )}
        </Stat>
        <Flex
          boxSize={12}
          flexShrink={0}
          align="center"
          justify="center"
          borderRadius="xl"
          bg="bg.subtle"
          color="accent.primary"
          aria-hidden
        >
          <Icon as={icon} boxSize={6} />
        </Flex>
      </Flex>
    </GlassCard>
  );
}

export default StatCard;
