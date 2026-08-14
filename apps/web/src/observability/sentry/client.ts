import * as Sentry from '@sentry/nextjs';
import { resolveOperationalDeviceClass } from '../operational/operational-context';
import { readSentryRuntimeConfig } from './config';
import { buildClientSentryOptions } from './options';

let initialized = false;

export function initializeSentryClient(): boolean {
  if (initialized) return true;
  try {
    const config = readSentryRuntimeConfig('client');
    if (!config.captureEnabled) return false;
    Sentry.init(buildClientSentryOptions(config));
    Sentry.setTag(
      'deviceClass',
      resolveOperationalDeviceClass(typeof window === 'undefined' ? 1280 : window.innerWidth),
    );
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function captureSentryRouterTransition(href: string, navigationType: string): void {
  if (!initializeSentryClient()) return;
  try {
    Sentry.captureRouterTransitionStart(href, navigationType);
  } catch {
    // Sentry is fail-open and never owns navigation.
  }
}

export function resetSentryClientForTests(): void {
  initialized = false;
}
