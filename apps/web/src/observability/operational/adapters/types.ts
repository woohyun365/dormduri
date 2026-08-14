import type { OperationalEvent } from '../operational-events';

export type OperationalTelemetryAdapter = Readonly<{
  emit(event: OperationalEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}>;
