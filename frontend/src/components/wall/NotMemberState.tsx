import { EmptyState } from '@/components/ui/EmptyState';
import { GradientButton } from '@/components/ui/GradientButton';
import { ROUTES } from '@/lib/routes';

/** Friendly 403 NOT_COURSE_MEMBER state for course-scoped pages. */
export function NotMemberState() {
  return (
    <EmptyState
      emoji="🚪"
      title="Indha course-la neenga member illa!"
      description="You need to be part of this course to see this page. Ask your instructor for the join code."
      action={<GradientButton to={ROUTES.courses}>Go to my courses</GradientButton>}
    />
  );
}

export default NotMemberState;
