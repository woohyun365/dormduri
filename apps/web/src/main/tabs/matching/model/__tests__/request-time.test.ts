import { describe, expect, it } from 'vitest';
import { getRequestTiming } from '../request-time';

describe('request timing display model', () => {
  it.each([
    ['2026-08-02T00:00:00.000Z', '1일 0시간 남음'],
    ['2026-08-01T01:00:00.000Z', '1시간 0분 남음'],
    ['2026-08-01T00:01:00.000Z', '0시간 1분 남음'],
  ])('serverNow 기준 expiry 경계를 표시한다: %s', (expiresAt, label) => {
    expect(
      getRequestTiming({
        serverNow: '2026-08-01T00:00:00.000Z',
        expiresAt,
        roomSelectionDate: null,
      }),
    ).toMatchObject({ kind: 'remaining', label, limitingEvent: 'expiry' });
  });

  it('roomSelectionDate가 먼저면 cutoff 안내를 선택하되 action 가능 여부는 만들지 않는다', () => {
    expect(
      getRequestTiming({
        serverNow: '2026-08-01T00:00:00.000Z',
        expiresAt: '2026-08-10T00:00:00.000Z',
        roomSelectionDate: '2026-08-02',
      }),
    ).toMatchObject({ kind: 'remaining', limitingEvent: 'cutoff' });
  });

  it('표시 시간이 지나면 expired copy만 반환한다', () => {
    expect(
      getRequestTiming({
        serverNow: '2026-08-01T00:00:00.000Z',
        expiresAt: '2026-08-01T00:00:00.000Z',
        roomSelectionDate: null,
      }),
    ).toEqual({ kind: 'expired', label: '요청 유효 시간이 지났어요', limitingEvent: 'expiry' });
  });
});
