import { initializeClientOperationalRuntime } from '@/observability/operational/client-runtime';
import {
  captureSentryRouterTransition,
  initializeSentryClient,
} from '@/observability/sentry/client';

initializeSentryClient();
initializeClientOperationalRuntime();

export function onRouterTransitionStart(href: string, navigationType: string): void {
  captureSentryRouterTransition(href, navigationType);
}
