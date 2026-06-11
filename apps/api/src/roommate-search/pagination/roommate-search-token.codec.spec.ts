import { createRoommateSearchTokenCodec } from './roommate-search-token.codec.js';

describe('roommate-search-token-codec', () => {
  const now = new Date('2026-05-31T00:00:00.000Z');

  it('MATCH_SCORE cursor는 score boundary와 queryDigest를 포함해 검증된다', () => {
    const codec = createRoommateSearchTokenCodec();
    const token = codec.signCursor({
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      queryDigest: 'digest-a',
      after: {
        matchScore: 80,
        nicknameSortKey: '나나',
        participantId: 'participant-b',
      },
      now,
    });

    expect(
      codec.verifyCursor({
        token,
        viewerUserId: 'viewer',
        seasonId: 'season-1',
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        queryDigest: 'digest-a',
        now,
      }).boundary,
    ).toEqual({
      matchScore: 80,
      nicknameSortKey: '나나',
      participantId: 'participant-b',
    });

    expect(() =>
      codec.verifyCursor({
        token,
        viewerUserId: 'viewer',
        seasonId: 'season-1',
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        queryDigest: 'digest-b',
        now,
      }),
    ).toThrow();
  });

  it('cursor tamper와 expiry를 fail-closed한다', () => {
    const codec = createRoommateSearchTokenCodec();
    const token = codec.signCursor({
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      sort: 'NICKNAME',
      queryDigest: 'digest-a',
      after: {
        nicknameSortKey: '나나',
        participantId: 'participant-b',
      },
      now,
    });
    const tampered = `${token.slice(0, -1)}x`;

    expect(() =>
      codec.verifyCursor({
        token: tampered,
        viewerUserId: 'viewer',
        seasonId: 'season-1',
        scope: 'SAME_BUILDING_ONLY',
        sort: 'NICKNAME',
        queryDigest: 'digest-a',
        now,
      }),
    ).toThrow();

    expect(() =>
      codec.verifyCursor({
        token,
        viewerUserId: 'viewer',
        seasonId: 'season-1',
        scope: 'SAME_BUILDING_ONLY',
        sort: 'NICKNAME',
        queryDigest: 'digest-a',
        now: new Date(now.getTime() + 11 * 60 * 1000),
      }),
    ).toThrow();
  });
});
