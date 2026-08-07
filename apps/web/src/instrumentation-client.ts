import { initializeClientOperationalRuntime } from '@/observability/operational/client-runtime';

initializeClientOperationalRuntime();

export function onRouterTransitionStart(): void {
  initializeClientOperationalRuntime();
}
