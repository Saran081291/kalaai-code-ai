import { useToast } from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';

import { GradientButton } from '@/components/ui/GradientButton';
import { useRetrySubmission } from '@/hooks/useSubmissionStatus';
import { getErrorMessage } from '@/services/api';

export interface RetryButtonProps {
  submissionId: number;
}

/** Re-queues a failed submission; the page goes back to polling. */
export function RetryButton({ submissionId }: RetryButtonProps) {
  const toast = useToast();
  const retry = useRetrySubmission(submissionId);

  const handleRetry = () => {
    retry.mutate(undefined, {
      onSuccess: () => {
        toast({ status: 'info', title: 'Thirumba try panrom! 🔁', description: 'Retry started.' });
      },
      onError: (err) => {
        toast({ status: 'error', title: 'Retry failed', description: getErrorMessage(err) });
      },
    });
  };

  return (
    <GradientButton leftIcon={<FiRefreshCw />} onClick={handleRetry} isLoading={retry.isPending} loadingText="Retrying">
      Retry review
    </GradientButton>
  );
}

export default RetryButton;
