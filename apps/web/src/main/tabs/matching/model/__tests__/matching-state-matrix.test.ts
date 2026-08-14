import { describe, expect, it } from 'vitest';
import {
  getMatchingSeasonStateRule,
  MATCHING_SEASON_STATES,
  MATCHING_SEASON_STATE_MATRIX,
  resolveServerScoreDisplay,
} from '../matching-state-matrix';

describe('matching season state matrix', () => {
  it('공식 four-season enum을 빠짐없이 명시한다', () => {
    expect(MATCHING_SEASON_STATES).toEqual([
      'OFF_SEASON',
      'SEASON_OPEN',
      'SEASON_MATCHING',
      'SEASON_POST_MATCH',
    ]);
    expect(Object.keys(MATCHING_SEASON_STATE_MATRIX)).toEqual(MATCHING_SEASON_STATES);
  });

  it('SEASON_MATCHING만 server capability 기반 matching action을 검토한다', () => {
    expect(getMatchingSeasonStateRule('OFF_SEASON').matchingActions).toBe('CLOSED');
    expect(getMatchingSeasonStateRule('SEASON_OPEN').matchingActions).toBe('CLOSED');
    expect(getMatchingSeasonStateRule('SEASON_MATCHING').matchingActions).toBe('SERVER_CAPABILITY');
    expect(getMatchingSeasonStateRule('SEASON_POST_MATCH').matchingActions).toBe('CLOSED');
  });

  it('SEASON_POST_MATCH에서는 active result만 유지하고 request/unmatch action을 닫는다', () => {
    const rule = getMatchingSeasonStateRule('SEASON_POST_MATCH');

    expect(rule.activeResultVisible).toBe(true);
    expect(rule.matchingActions).toBe('CLOSED');
  });

  it('score visibility와 numeric score를 서버 contract에서만 받는다', () => {
    expect(resolveServerScoreDisplay({ scoreVisible: false, matchScore: 99 })).toEqual({
      kind: 'hidden',
    });
    expect(resolveServerScoreDisplay({ scoreVisible: true, matchScore: 84 })).toEqual({
      kind: 'visible',
      value: 84,
    });
    expect(resolveServerScoreDisplay({ scoreVisible: true, matchScore: undefined })).toEqual({
      kind: 'unavailable',
    });
  });

  it('알 수 없는 season state는 fall-through 하지 않는다', () => {
    expect(() => getMatchingSeasonStateRule('POST_MATCH' as never)).toThrow(
      'Unsupported matching season state: POST_MATCH',
    );
  });
});
