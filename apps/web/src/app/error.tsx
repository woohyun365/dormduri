'use client';

import { useEffect, useState } from 'react';
import { ErrorRecoveryView } from '@/observability/operational/ErrorRecoveryView';
import { recordClientRuntimeError } from '@/observability/operational/client-runtime';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    recordClientRuntimeError({
      error,
      source: 'route_boundary',
      handled: true,
      digestPresent: Boolean(error.digest),
    });
  }, [error]);

  const handleRetry = () => {
    setRetrying(true);
    recordClientRuntimeError({
      error,
      source: 'route_boundary',
      handled: true,
      digestPresent: Boolean(error.digest),
      recoveryAction: 'retry',
      recoveryOutcome: 'unknown',
    });
    reset();
  };

  return <ErrorRecoveryView onRecover={handleRetry} recovering={retrying} scope="route" />;
}
