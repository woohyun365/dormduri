import { describe, expect, it } from 'vitest';
import {
  clearRecordedSentryEnvelopes,
  createRecordingSentryTransport,
  getRecordedSentryEnvelopes,
} from '../recording-transport';

describe('Sentry recording transport', () => {
  it('envelope를 외부 network 없이 기록한다', async () => {
    clearRecordedSentryEnvelopes();
    const transport = createRecordingSentryTransport();
    const envelope = [{ event_id: 'event-1' }, [[{ type: 'event' }, { type: 'Error' }]]] as never;

    await transport.send(envelope);

    expect(getRecordedSentryEnvelopes()).toEqual([envelope]);
  });

  it('provider rejection을 주입할 수 있다', async () => {
    const transport = createRecordingSentryTransport({ reject: true });
    await expect(transport.send([{}, []] as never)).rejects.toThrow('recording_transport_rejected');
  });
});
