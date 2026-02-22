export type MatchingStatus = 'none' | 'pending' | 'matched';

export const MATCHING: {
  status: MatchingStatus;
  sentCount: number;
  receivedCount: number;
  matchedNickname: string | null;
} = {
  status: 'none',
  sentCount: 0,
  receivedCount: 0,
  matchedNickname: null,
};
