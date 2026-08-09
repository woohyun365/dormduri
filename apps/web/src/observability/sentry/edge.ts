import * as Sentry from '@sentry/nextjs';
import { readSentryRuntimeConfig } from './config';
import { buildEdgeSentryOptions } from './options';

let initialized = false;

export function initializeSentryEdge(): boolean {
  if (initialized) return true;
  try {
    const config = readSentryRuntimeConfig('edge');
    if (!config.captureEnabled) return false;
    Sentry.init(buildEdgeSentryOptions(config));
    initialized = true;
    return true;
  } catch {
    return false;
  }
}
