import { toActiveMatchLifecycleEventMetadata } from './active-match-lifecycle-event.metadata.js';

class NonPlainMetadataValue {
  constructor(readonly value: string) {}
}

describe('active match lifecycle event metadata mapper', () => {
  it('allowlist key만 JSON-serializable 값으로 보존하고 raw/sensitive payload key는 제거한다', () => {
    const input = {
      transitionOwner: 'match.accept',
      previousStatus: 'PENDING',
      nextStatus: 'ACTIVE',
      previousEndedAt: null,
      nextEndedAt: new Date('2026-02-10T03:00:00.000Z'),
      expiredUnmatchRequestCount: 2,
      chatMatchedThreadUpdated: true,
      seasonState: {
        current: 'SEASON_MATCHING',
        details: {
          matchingOpen: true,
          roomSelectionDate: new Date('2026-02-12T00:00:00.000Z'),
          email: 'nested@example.com',
          token: 'nested-token',
          stack: 'nested stack',
          unsupportedArray: ['drop'],
          unsupportedBigInt: BigInt(1),
        },
      },
      note: 'raw note must not be stored',
      profile: { lifestyle: 'raw profile' },
      lifestyle: { bedtime: '02:00' },
      chatBody: 'message text',
      messageBody: 'message text',
      retainedBody: 'retained text',
      vaultPayload: { secret: true },
      email: 'student@example.com',
      phone: '010-0000-0000',
      token: 'secret-token',
      providerAccessToken: 'oauth-token',
      requestBody: { raw: true },
      responseBody: { raw: true },
      stack: 'stack trace',
      prismaError: { code: 'P2002' },
      internalAuditPayload: { raw: true },
      identitySnapshot: { userId: 'user-1' },
    };

    expect(toActiveMatchLifecycleEventMetadata(input)).toEqual({
      transitionOwner: 'match.accept',
      previousStatus: 'PENDING',
      nextStatus: 'ACTIVE',
      previousEndedAt: null,
      nextEndedAt: '2026-02-10T03:00:00.000Z',
      expiredUnmatchRequestCount: 2,
      chatMatchedThreadUpdated: true,
      seasonState: {
        current: 'SEASON_MATCHING',
        details: {
          matchingOpen: true,
          roomSelectionDate: '2026-02-12T00:00:00.000Z',
        },
      },
    });
  });

  it('undefined, array, function, symbol, bigint, non-finite number, class object는 저장하지 않는다', () => {
    expect(
      toActiveMatchLifecycleEventMetadata({
        transitionOwner: undefined,
        previousStatus: ['ACTIVE'],
        nextStatus: () => 'ACTIVE',
        previousEndReason: Symbol('reason'),
        nextEndReason: BigInt(1),
        expiredUnmatchRequestCount: Number.NaN,
        canceledPendingMatchRequests: Number.POSITIVE_INFINITY,
        seasonState: new NonPlainMetadataValue('SEASON_MATCHING'),
        chatDirectThreadsReopened: {
          kept: true,
          droppedArray: ['drop'],
          droppedFunction: () => undefined,
          droppedEmptyObject: { value: undefined },
        },
      }),
    ).toEqual({
      chatDirectThreadsReopened: {
        kept: true,
      },
    });
  });

  it('input object를 mutate하지 않고 저장할 allowlist 값이 없으면 undefined를 반환한다', () => {
    const input = {
      transitionOwner: undefined,
      token: 'secret-token',
      nested: { raw: true },
    };
    const before = structuredClone(input);

    expect(toActiveMatchLifecycleEventMetadata(input)).toBeUndefined();
    expect(input).toEqual(before);
    expect(toActiveMatchLifecycleEventMetadata(null)).toBeUndefined();
    expect(toActiveMatchLifecycleEventMetadata()).toBeUndefined();
  });
});
