import type { OperationalEvent, WebBffRequestCompletedEvent } from './operational-events';
import { sanitizeOperationalEvent } from './sanitize-operational-event';

export type ServerOperationalEventWriter = (event: OperationalEvent) => void | Promise<void>;

let serverWriter: ServerOperationalEventWriter = (event) => {
  console.info(JSON.stringify({ logType: 'web_operational', ...event }));
};

export function recordServerOperationalEvent(event: WebBffRequestCompletedEvent): void {
  const sanitized = sanitizeOperationalEvent(event, { allowLogCorrelationFields: true });
  if (!sanitized) return;
  try {
    void Promise.resolve(serverWriter(sanitized)).catch(() => undefined);
  } catch {
    // Structured logging is fail-open and does not own the BFF response.
  }
}

export function setServerOperationalEventWriterForTests(
  writer: ServerOperationalEventWriter,
): () => void {
  const previous = serverWriter;
  serverWriter = writer;
  return () => {
    serverWriter = previous;
  };
}
