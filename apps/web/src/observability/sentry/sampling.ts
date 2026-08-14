import { resolveOperationalRouteGroup } from '../operational/operational-context';

export function normalizeSentryTransactionName(pathname: string | undefined): string {
  return resolveOperationalRouteGroup(pathname);
}

export function resolveSentryTraceSampleRate(input: {
  enabled: boolean;
  configuredRate: number;
}): number {
  if (!input.enabled) return 0;
  if (!Number.isFinite(input.configuredRate)) return 0;
  return Math.min(1, Math.max(0, input.configuredRate));
}
