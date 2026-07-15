import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createPublicProfileFull,
  createPublicProfileTombstone,
} from '@/test/home-profile-detail-fixtures';
import { MatchingApiError } from '../../api/matching.api';
import { MatchHistoryDetailContent } from '../MatchHistoryDetailContent';

describe('MatchHistoryDetailContent', () => {
  it('PAST_MATCH_HISTORY FULL detail에는 materialized score만 표시한다', () => {
    render(
      <MatchHistoryDetailContent
        profile={createPublicProfileFull({
          resultRead: { resultReadable: true, context: 'PAST_MATCH_HISTORY' },
          matchScore: 91,
        })}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText('당시 매칭도 91점')).toBeInTheDocument();
    expect(screen.queryByText('현재 매칭도 91점')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '감자친구' })).toHaveClass('wrap-break-word');
  });

  it('tombstone은 score와 full profile을 보강하지 않는다', () => {
    render(
      <MatchHistoryDetailContent
        profile={createPublicProfileTombstone({
          tombstone: {
            reason: 'TARGET_NO_LONGER_DISCOVERABLE',
            displayName: '탈퇴한 사용자',
            message: '상세 정보를 볼 수 없어요.',
          },
        })}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText('탈퇴한 사용자')).toBeInTheDocument();
    expect(screen.queryByText(/매칭도/)).not.toBeInTheDocument();
  });

  it('unavailable error는 재시도 control을 만들지 않는다', () => {
    render(
      <MatchHistoryDetailContent
        profile={null}
        loading={false}
        error={new MatchingApiError('MATCHING_HISTORY_DETAIL_UNAVAILABLE')}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('더 이상 확인할 수 없어요');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
