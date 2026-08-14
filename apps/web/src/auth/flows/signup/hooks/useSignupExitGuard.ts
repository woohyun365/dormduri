'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseSignupExitGuardParams {
  shouldWarn: boolean;
  onConfirmExit: () => void;
}

export function useSignupExitGuard({ shouldWarn, onConfirmExit }: UseSignupExitGuardParams) {
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);

  useEffect(() => {
    if (!shouldWarn) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldWarn]);

  const requestExit = useCallback(() => {
    if (!shouldWarn) return true;
    setIsExitDialogOpen(true);
    return false;
  }, [shouldWarn]);

  const cancelExit = useCallback(() => {
    setIsExitDialogOpen(false);
  }, []);

  const confirmExit = useCallback(() => {
    setIsExitDialogOpen(false);
    onConfirmExit();
  }, [onConfirmExit]);

  return {
    isExitDialogOpen,
    requestExit,
    cancelExit,
    confirmExit,
  };
}
