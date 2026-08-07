import type { OperationalEvent } from './operational-events';
import { sanitizeOperationalEvent } from './sanitize-operational-event';
import type { OperationalTelemetryAdapter } from './adapters/types';
import { noopOperationalTelemetryAdapter } from './adapters/noop';

const DEFAULT_QUEUE_LIMIT = 50;

export class OperationalTelemetry {
  private readonly queue: OperationalEvent[] = [];
  private scheduled = false;

  constructor(
    private adapter: OperationalTelemetryAdapter = noopOperationalTelemetryAdapter,
    private readonly queueLimit = DEFAULT_QUEUE_LIMIT,
  ) {}

  setAdapter(adapter: OperationalTelemetryAdapter): void {
    this.adapter = adapter;
  }

  emit(candidate: unknown): void {
    const event = sanitizeOperationalEvent(candidate);
    if (!event) return;

    if (this.queue.length >= this.queueLimit) {
      this.queue.shift();
    }
    this.queue.push(event);
    if (this.scheduled) return;

    this.scheduled = true;
    queueMicrotask(() => {
      void this.flush();
    });
  }

  async flush(): Promise<void> {
    this.scheduled = false;
    const pending = this.queue.splice(0, this.queue.length);
    for (const event of pending) {
      try {
        await this.adapter.emit(event);
      } catch {
        // Operational telemetry is fail-open and never owns product state.
      }
    }
    try {
      await this.adapter.flush?.();
    } catch {
      // Adapter delivery failure must not affect user flows.
    }
  }
}

export const operationalTelemetry = new OperationalTelemetry();

export function recordOperationalEvent(event: OperationalEvent): void {
  operationalTelemetry.emit(event);
}

export function setOperationalTelemetryAdapter(adapter: OperationalTelemetryAdapter): () => void {
  operationalTelemetry.setAdapter(adapter);
  return () => operationalTelemetry.setAdapter(noopOperationalTelemetryAdapter);
}
