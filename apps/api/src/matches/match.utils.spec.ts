import {
  addDays,
  buildParticipantPairIdentity,
  isCooldownActive,
  resolveDormitoryRoomSelectionEnd,
  resolveMatchRequestExpiresAt,
} from './match.utils.js';

describe('match.utils', () => {
  it('unordered participant pair를 deterministic key로 정렬한다', () => {
    expect(buildParticipantPairIdentity('participant-b', 'participant-a')).toEqual({
      pairMinParticipantId: 'participant-a',
      pairMaxParticipantId: 'participant-b',
      pairKey: 'participant-a:participant-b',
    });
  });

  it('request expiry는 5일 TTL과 roomSelectionDate 중 더 이른 시점을 사용한다', () => {
    const createdAt = new Date('2026-02-10T03:00:00.000Z');

    expect(resolveMatchRequestExpiresAt(createdAt, '2026-02-11')).toEqual(
      resolveDormitoryRoomSelectionEnd('2026-02-11'),
    );
    expect(resolveMatchRequestExpiresAt(createdAt, '2026-02-20')).toEqual(addDays(createdAt, 5));
  });

  it('2일 cooldown 경계를 계산한다', () => {
    const terminalAt = new Date('2026-02-10T03:00:00.000Z');

    expect(isCooldownActive(terminalAt, new Date('2026-02-11T12:00:00.000Z'))).toBe(true);
    expect(isCooldownActive(terminalAt, new Date('2026-02-12T03:00:00.000Z'))).toBe(false);
  });
});
