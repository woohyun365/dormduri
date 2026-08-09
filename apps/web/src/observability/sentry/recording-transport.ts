import type * as Sentry from '@sentry/nextjs';

type SentryOptions = Parameters<typeof Sentry.init>[0];
type SentryTransportFactory = NonNullable<SentryOptions['transport']>;
type SentryTransport = ReturnType<SentryTransportFactory>;

export type RecordedSentryEnvelope = Parameters<SentryTransport['send']>[0];

const envelopes: RecordedSentryEnvelope[] = [];

export function createRecordingSentryTransport(
  options: { reject?: boolean } = {},
): SentryTransport {
  return {
    send(envelope) {
      envelopes.push(envelope);
      if (options.reject) return Promise.reject(new Error('recording_transport_rejected'));
      return Promise.resolve({ statusCode: 200 });
    },
    flush() {
      return Promise.resolve(true);
    },
  };
}

export function getRecordedSentryEnvelopes(): readonly RecordedSentryEnvelope[] {
  return envelopes;
}

export function clearRecordedSentryEnvelopes(): void {
  envelopes.splice(0, envelopes.length);
}
