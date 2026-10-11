import { Button } from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';

import { MotionBox } from '@/components/ui/motion';
import { GOOGLE_LOGIN_URL } from '@/lib/env';

export interface GoogleLoginButtonProps {
  label?: string;
  isDisabled?: boolean;
}

/** Starts the Google OAuth flow with a full-page redirect to the backend. */
export function GoogleLoginButton({ label = 'Continue with Google', isDisabled = false }: GoogleLoginButtonProps) {
  const handleClick = () => {
    window.location.href = GOOGLE_LOGIN_URL;
  };

  return (
    <MotionBox
      w="full"
      whileHover={isDisabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
    >
      <Button
        type="button"
        w="full"
        size="lg"
        variant="outline"
        borderRadius="full"
        bg="bg.surface"
        borderColor="border.strong"
        leftIcon={<FcGoogle aria-hidden />}
        onClick={handleClick}
        isDisabled={isDisabled}
      >
        {label}
      </Button>
    </MotionBox>
  );
}

export default GoogleLoginButton;
