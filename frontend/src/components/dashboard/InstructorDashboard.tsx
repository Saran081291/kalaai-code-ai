import { Box, Stack } from '@chakra-ui/react';
import { FiActivity, FiBookOpen, FiSend, FiUsers } from 'react-icons/fi';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradientButton } from '@/components/ui/GradientButton';
import { ROUTES } from '@/lib/routes';
import type { InstructorDashboard as InstructorDashboardData } from '@/types';

import { CourseStats } from './CourseStats';
import { FailedReviewsAlert } from './FailedReviewsAlert';
import { RecentSubmissions } from './RecentSubmissions';
import { SectionHeading } from './SectionHeading';
import { StatCard } from './StatCard';

export interface InstructorDashboardProps {
  data: InstructorDashboardData;
  now?: Date;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Instructor (and admin) view: stats, failed reviews, recent submissions, per-course stats. */
export function InstructorDashboard({ data, now }: InstructorDashboardProps) {
  if (data.courseStats.length === 0) {
    return (
      <EmptyState
        icon={FiBookOpen}
        title="First course create pannunga, annae!"
        description="Create a course, share the join code with students, and the roasts will start rolling in."
        action={<GradientButton to={ROUTES.courseNew}>Create a course</GradientButton>}
      />
    );
  }

  const { courseStats } = data;

  return (
    <Stack spacing={10}>
      <AnimatedList columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
        <StatCard key="courses" label="Courses" value={courseStats.length} icon={FiBookOpen} />
        <StatCard
          key="students"
          label="Total students"
          value={sum(courseStats.map((c) => c.studentCount))}
          icon={FiUsers}
        />
        <StatCard
          key="submissions"
          label="Total submissions"
          value={sum(courseStats.map((c) => c.submissionCount))}
          icon={FiSend}
        />
        <StatCard
          key="in-progress"
          label="In progress"
          value={sum(courseStats.map((c) => c.inProgressCount))}
          icon={FiActivity}
        />
      </AnimatedList>

      <FailedReviewsAlert submissions={data.failedSubmissions} />

      <Box as="section" aria-labelledby="recent-submissions-heading">
        <SectionHeading
          id="recent-submissions-heading"
          title="Recent submissions"
          subtitle="Pasanga latest-a enna anuppirukkaanga?"
        />
        <RecentSubmissions submissions={data.recentSubmissions} now={now} />
      </Box>

      <Box as="section" aria-labelledby="course-stats-heading">
        <SectionHeading
          id="course-stats-heading"
          title="Your courses"
          subtitle="Course-wise kanakku"
          linkTo={ROUTES.courses}
          linkLabel="All courses"
        />
        <CourseStats stats={courseStats} />
      </Box>
    </Stack>
  );
}

export default InstructorDashboard;
