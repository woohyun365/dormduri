import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PastSeasonAccordion } from '../PastSeasonAccordion';
import type { PastSeasonData } from '@/types/match';

const season: PastSeasonData = {
  id: 'ps-1',
  name: '2025-1학기',
  dormitoryIdSnapshot: 'toegye',
  matchResult: 'success',
  matchedWith: '별빛여행',
  receivedCount: 7,
  sentCount: 3,
  chatCount: 4,
  history: [
    {
      id: 'ph-1',
      nickname: '홍길동',
      preset: 'MATCHED_SUCCESS',
    },
    {
      id: 'ph-2',
      nickname: '바람소리',
      status: 'CONVERSATION_ENDED',
      date: '2025-06-20',
    },
    {
      id: 'ph-3',
      nickname: '별밤산책',
      preset: 'MATCH_UNMATCHED',
    },
    {
      id: 'ph-4',
      nickname: '여름소풍',
      preset: 'RECEIVED_CANCELLED',
    },
    {
      id: 'ph-5',
      nickname: '여름소풍',
      preset: 'RECEIVED_CANCELLED',
    },
  ],
};

describe('PastSeasonAccordion', () => {
  it('건물 스냅샷만 보여주고 과거 이력 시간 표시는 숨긴다', () => {
    render(<PastSeasonAccordion season={season} defaultExpanded />);

    expect(screen.getByText('퇴계관')).toBeInTheDocument();
    expect(screen.getByText('별빛여행')).toBeInTheDocument();
    expect(screen.getByText('매칭 성사')).toBeInTheDocument();
    expect(screen.getByText('확정 이후')).toBeInTheDocument();
    expect(screen.getByText('확정 후 매칭이 해제됐어요')).toBeInTheDocument();
    expect(screen.getByText('상대가 2회 요청을 취소했어요')).toBeInTheDocument();
    expect(screen.queryByText(/2025\.06\.20/)).not.toBeInTheDocument();
    expect(screen.queryByText(/개월 전|년 전|일 전|오늘|어제/)).not.toBeInTheDocument();
  });
});
