import { describe, expect, it } from 'vitest';
import {
  assertValidSeasonOverride,
  assertValidSeasonSchedule,
} from './season-operations.policy.js';

interface HttpExceptionLike {
  getResponse(): unknown;
}

function hasGetResponse(error: unknown): error is HttpExceptionLike {
  if (typeof error !== 'object' || error === null || !('getResponse' in error)) {
    return false;
  }

  return typeof error.getResponse === 'function';
}

function expectPolicyErrorCode(action: () => void, code: string) {
  try {
    action();
    throw new Error('Expected policy to throw');
  } catch (error) {
    expect(hasGetResponse(error)).toBe(true);

    if (!hasGetResponse(error)) {
      throw error;
    }

    const response = error.getResponse();
    expect(response).toMatchObject({ code });
  }
}

describe('season-operations.policy', () => {
  it('schedule 날짜 순서를 preparation <= matching <= seasonEnd로 고정한다', () => {
    expectPolicyErrorCode(
      () =>
        assertValidSeasonSchedule({
          expectedUpdatedAt: '2026-02-01T00:00:00.000Z',
          preparationStartDate: '2026-02-10',
          matchingStartDate: '2026-02-09',
          seasonEndDate: '2026-02-20',
        }),
      'SEASONS_OPERATION_INVALID_SCHEDULE',
    );

    expectPolicyErrorCode(
      () =>
        assertValidSeasonSchedule({
          expectedUpdatedAt: '2026-02-01T00:00:00.000Z',
          preparationStartDate: '2026-02-01',
          matchingStartDate: '2026-02-21',
          seasonEndDate: '2026-02-20',
        }),
      'SEASONS_OPERATION_INVALID_SCHEDULE',
    );
  });

  it('override window는 startsAt <= endsAt만 허용한다', () => {
    expectPolicyErrorCode(
      () =>
        assertValidSeasonOverride({
          expectedUpdatedAt: '2026-02-01T00:00:00.000Z',
          state: 'SEASON_MATCHING',
          reason: 'incident response',
          startsAt: '2026-02-11T00:00:00.000Z',
          endsAt: '2026-02-10T00:00:00.000Z',
        }),
      'SEASONS_OPERATION_INVALID_OVERRIDE_WINDOW',
    );
  });
});
