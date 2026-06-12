import 'reflect-metadata';

const SUPPRESSED_PG_QUERY_DEPRECATION =
  'Calling client.query() when the client is already executing a query is deprecated';
const originalEmitWarning = process.emitWarning.bind(process);

// Keep this exact filter in Vitest integration/e2e runs so the known
// Prisma adapter-pg warning stays suppressed without hiding unrelated warnings.
process.emitWarning = (warning, ...args) => {
  const message =
    typeof warning === 'string'
      ? warning
      : warning && typeof warning.message === 'string'
        ? warning.message
        : null;
  const warningType =
    typeof warning === 'string'
      ? typeof args[0] === 'string'
        ? args[0]
        : null
      : warning && typeof warning.name === 'string'
        ? warning.name
        : null;

  if (
    warningType === 'DeprecationWarning' &&
    typeof message === 'string' &&
    message.startsWith(SUPPRESSED_PG_QUERY_DEPRECATION)
  ) {
    return;
  }

  (originalEmitWarning as (...forwardedArgs: unknown[]) => void)(warning, ...args);
};
