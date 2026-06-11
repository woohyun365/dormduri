import { sortByMatchScore, sortByNickname } from './roommate-search-score-sort.policy.js';

const item = (input: {
  id: string;
  nickname: string;
  matchScore?: number;
  scoreVisible?: boolean;
}) => ({
  summary: {
    exposure: {
      scoreVisible: input.scoreVisible ?? typeof input.matchScore === 'number',
    },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
  },
  cursorBoundary: {
    nicknameSortKey: input.nickname,
    participantId: input.id,
  },
});

describe('roommate-search-score-sort.policy', () => {
  it('NICKNAME sort는 nicknameSortKey와 participantId로 deterministic ordering을 만든다', () => {
    expect(
      sortByNickname([
        item({ id: 'p-2', nickname: '나나' }),
        item({ id: 'p-3', nickname: '가가' }),
        item({ id: 'p-1', nickname: '나나' }),
      ]).map((entry) => entry.cursorBoundary.participantId),
    ).toEqual(['p-3', 'p-1', 'p-2']);
  });

  it('MATCH_SCORE sort는 score desc 이후 nickname/participantId로 deterministic ordering을 만든다', () => {
    expect(
      sortByMatchScore([
        item({ id: 'p-4', nickname: '다다', matchScore: 90 }),
        item({ id: 'p-2', nickname: '나나', matchScore: 95 }),
        item({ id: 'p-3', nickname: '가가', matchScore: 95 }),
        item({ id: 'p-1', nickname: '나나', matchScore: 95 }),
      ]).map((entry) => entry.cursorBoundary.participantId),
    ).toEqual(['p-3', 'p-1', 'p-2', 'p-4']);
  });

  it('MATCH_SCORE sort는 latest policy/materialization에서 scoreVisible이 닫힌 item을 제외한다', () => {
    expect(
      sortByMatchScore([
        item({ id: 'p-1', nickname: '가가', matchScore: 90 }),
        item({ id: 'p-2', nickname: '나나', matchScore: 100, scoreVisible: false }),
        item({ id: 'p-3', nickname: '다다' }),
      ]).map((entry) => entry.cursorBoundary.participantId),
    ).toEqual(['p-1']);
  });
});
