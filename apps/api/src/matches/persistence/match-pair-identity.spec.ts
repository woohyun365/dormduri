import { buildParticipantPairIdentity } from './match-pair-identity.js';

describe('match pair identity', () => {
  it('unordered participant pair를 deterministic key로 정렬한다', () => {
    expect(buildParticipantPairIdentity('participant-b', 'participant-a')).toEqual({
      pairMinParticipantId: 'participant-a',
      pairMaxParticipantId: 'participant-b',
      pairKey: 'participant-a:participant-b',
    });
  });
});
