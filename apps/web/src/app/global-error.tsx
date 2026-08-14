'use client';

import { useEffect } from 'react';
import { ErrorRecoveryView } from '@/observability/operational/ErrorRecoveryView';
import { recordClientRuntimeError } from '@/observability/operational/client-runtime';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    recordClientRuntimeError({
      error,
      source: 'global_boundary',
      severity: 'fatal',
      handled: true,
      digestPresent: Boolean(error.digest),
    });
  }, [error]);

  const handleReload = () => {
    recordClientRuntimeError({
      error,
      source: 'global_boundary',
      severity: 'fatal',
      handled: true,
      digestPresent: Boolean(error.digest),
      recoveryAction: 'reload',
      recoveryOutcome: 'unknown',
    });
    window.location.reload();
  };

  return (
    <html lang="ko">
      <body>
        <ErrorRecoveryView onRecover={handleReload} scope="global" />
      </body>
    </html>
  );
}
