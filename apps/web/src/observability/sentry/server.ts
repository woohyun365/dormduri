import * as Sentry from '@sentry/nextjs';
import { readSentryRuntimeConfig } from './config';
import { buildServerSentryOptions } from './options';

let initialized = false;

export function initializeSentryServer(): boolean {
  if (initialized) return true;
  try {
    const config = readSentryRuntimeConfig('node');
    if (!config.captureEnabled) return false;
    Sentry.init(buildServerSentryOptions(config));
    initialized = true;
    return true;
  } catch {
    return false;
  }
}
