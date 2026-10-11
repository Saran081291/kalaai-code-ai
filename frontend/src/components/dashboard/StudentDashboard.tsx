import { Box, SimpleGrid, Stack } from '@chakra-ui/react';
import { FiAward, FiBookOpen, FiSend } from 'react-icons/fi';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradientButton } from '@/components/ui/GradientButton';
import { ROUTES } from '@/lib/routes';
import type { StudentDashboard as StudentDashboardData } from '@/types';

import { RankCards } from './RankCards';
import { RecentResults } from './RecentResults';
import { SectionHeading } from './SectionHeading';
import { StatCard } from './StatCard';
import { UpcomingList } from './UpcomingList';

export interface StudentDashboardProps {
  data: StudentDashboardData;
  now?: Date;
}

function bestRank(data: StudentDashboardData): number | null {
  const ranks = data.ranks.map((r) => r.rank).filter((r): r is number => r !== null);
  return ranks.length > 0 ? Math.min(...ranks) : null;
}

/** Student view: stats, upcoming assignments, recent results and course ranks. */
export function StudentDashboard({ data, now }: StudentDashboardProps) {
  if (data.ranks.length === 0) {
    return (
      <EmptyState
        icon={FiBookOpen}
        title="Mudhalla oru course join pannunga, thambi!"
        description="Ask your instructor for the join code — then assignments, roasts and ranks will show up here."
        action={<GradientButton to={ROUTES.courseJoin}>Join a course</GradientButton>}
      />
    );
  }

  const best = bestRank(data);

  return (
    <Stack spacing={10}>
      <AnimatedList columns={{ base: 1, sm: 3 }} spacing={4}>
        <StatCard key="courses" label="Courses enrolled" value={data.ranks.length} icon={FiBookOpen} />
        <StatCard
          key="best-rank"
          label="Best rank"
          value={best === null ? '—' : `#${best}`}
          icon={FiAward}
          helpText={best === null ? 'Not ranked yet' : undefined}
        />
        <StatCard key="submissions" label="Recent submissions" value={data.recentResults.length} icon={FiSend} />
      </AnimatedList>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 10, lg: 8 }} alignItems="start">
        <Box as="section" aria-labelledby="upcoming-heading">
          <SectionHeading id="upcoming-heading" title="Upcoming assignments" subtitle="Deadline nerungudhu — get ready!" />
          <UpcomingList items={data.upcomingAssignments} now={now} />
        </Box>
        <Box as="section" aria-labelledby="results-heading">
          <SectionHeading
            id="results-heading"
            title="Recent results"
            subtitle="Unga latest roasts & scores"
            linkTo={ROUTES.mySubmissions}
            linkLabel="View all"
          />
          <RecentResults results={data.recentResults} now={now} />
        </Box>
      </SimpleGrid>

      <Box as="section" aria-labelledby="ranks-heading">
        <SectionHeading id="ranks-heading" title="Your ranks" subtitle="Leaderboard-la neenga enga irukeenga?" />
        <RankCards ranks={data.ranks} />
      </Box>
    </Stack>
  );
}

export default StudentDashboard;
