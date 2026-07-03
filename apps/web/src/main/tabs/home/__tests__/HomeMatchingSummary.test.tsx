import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeMatchingSummary } from '../sections/matching/HomeMatchingSummary';
import type { HomeMatchingSummaryProps } from '../sections/matching/HomeMatchingSummary';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';

function stubPublicProfileFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(createPublicProfileFull({ nickname: '민지' })), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

const defaultProps: HomeMatchingSummaryProps = {
  status: 'NO_ACTIVITY',
  stats: { sentRequests: 0, receivedRequests: 0, activeChats: 0 },
  activeMatchRoomSelection: {
    date: '08.06',
    dormitoryName: '다온관',
  },
  onNavigate: vi.fn(),
};

const activeMatch: NonNullable<HomeMatchingSummaryProps['activeMatch']> = {
  id: 'active-match-1',
  counterpartUserId: 'user-2',
  counterpartParticipantId: 'participant-2',
  nickname: '민지',
  matchScore: 92,
  matchedAt: '2026-08-02T00:00:00.000Z',
  unmatchProgress: {
    state: 'NONE',
    requestedByViewerAt: null,
    requestedByCounterpartAt: null,
    progressCount: 0,
    requiredCount: 2,
    canRequest: true,
    canCancel: false,
    availableUntil: '2026-08-06T14:59:59.000Z',
  },
  counterpartSummary: {
    id: 'user-2',
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'MATCHED_PARTNER' },
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: true,
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: true,
      unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
    },
    resultRead: {
      resultReadable: true,
      context: 'CURRENT_MATCHED_PARTNER',
    },
    profileSummary: {
      nickname: '민지',
      intro: '아침형 생활패턴이고 조용한 방을 선호해요.',
      smokingBehavior: 'NO',
      sleepHabit: 'NONE',
      relationshipStyle: 'CLOSE',
    },
    matchScore: 92,
  },
};

describe('HomeMatchingSummary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registration 전 매칭 기간은 시즌 참여 준비 gate를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} gatingReason="registration_required" />);

    expect(screen.getByText('시즌 참여가 필요해요')).toBeDefined();
    expect(screen.getByRole('button', { name: /시즌 참여 준비하기/ })).toBeDefined();
    expect(screen.queryByText('보낸 요청')).toBeNull();
  });

  it('ACTIVE_MATCH에서 확정 상대, 프로필 모달 CTA, 해제 진행률을 표시한다', async () => {
    const user = userEvent.setup();
    stubPublicProfileFetch();
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="ACTIVE_MATCH"
        stats={{ sentRequests: 0, receivedRequests: 0, activeChats: 1 }}
        activeMatch={activeMatch}
      />,
    );

    expect(screen.getByRole('heading', { name: '확정된 룸메이트' })).toBeInTheDocument();
    expect(screen.getByText('민지')).toBeInTheDocument();
    expect(screen.getByText('해제 진행')).toBeInTheDocument();
    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.getByText('호실 선택일')).toBeInTheDocument();
    expect(screen.queryByText(/확정된 룸메이트예요/)).not.toBeInTheDocument();
    expect(screen.getByText('08.06')).toBeInTheDocument();
    expect(screen.getByText('다온관 기준')).toBeInTheDocument();
    expect(screen.queryByText('확정 대화')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /채팅 바로가기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /상대 프로필 보기/ })).toBeInTheDocument();
    expect(
      screen.queryByText(
        '매칭 해제는 양쪽이 모두 요청해야 완료돼요. 한쪽 요청만으로는 현재 매칭이 유지돼요.',
      ),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /상대 프로필 보기/ }));

    expect(screen.getByRole('dialog', { name: '상대 프로필' })).toBeInTheDocument();
    expect(
      await screen.findByText('아침형 생활패턴이고 조용한 방을 선호해요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('생활패턴·기본 정보')).toBeInTheDocument();
  });

  it('ACTIVE_MATCH에서 매칭 해제 요청을 확인 modal로 보낸다', async () => {
    const user = userEvent.setup();
    const onRequestUnmatch = vi.fn().mockResolvedValue(undefined);
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="ACTIVE_MATCH"
        activeMatch={activeMatch}
        onRequestUnmatch={onRequestUnmatch}
      />,
    );

    await user.click(screen.getByRole('button', { name: '매칭 해제 요청' }));
    expect(screen.getByRole('dialog', { name: '매칭 해제 요청' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '해제 요청하기' }));

    await waitFor(() => expect(onRequestUnmatch).toHaveBeenCalledWith('active-match-1'));
  });

  it('ACTIVE_MATCH에서 상대 해제 요청이 도착하면 내가 해제 요청을 완료할 수 있다', async () => {
    const user = userEvent.setup();
    const onRequestUnmatch = vi.fn().mockResolvedValue(undefined);
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="ACTIVE_MATCH"
        activeMatch={{
          ...activeMatch,
          unmatchProgress: {
            ...activeMatch.unmatchProgress,
            state: 'WAITING_FOR_ME',
            requestedByCounterpartAt: '2026-08-02T00:00:00.000Z',
            progressCount: 1,
            canRequest: true,
            canCancel: false,
          },
        }}
        onRequestUnmatch={onRequestUnmatch}
      />,
    );

    expect(screen.getByText('상대 요청 도착')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '매칭 해제 요청' }));
    await user.click(screen.getByRole('button', { name: '해제 요청하기' }));

    await waitFor(() => expect(onRequestUnmatch).toHaveBeenCalledWith('active-match-1'));
  });

  it('ACTIVE_MATCH에서 본인 해제 요청은 철회할 수 있다', async () => {
    const user = userEvent.setup();
    const onCancelUnmatchRequest = vi.fn().mockResolvedValue(undefined);
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="ACTIVE_MATCH"
        activeMatch={{
          ...activeMatch,
          unmatchProgress: {
            ...activeMatch.unmatchProgress,
            state: 'WAITING_FOR_COUNTERPART',
            requestedByViewerAt: '2026-08-02T00:00:00.000Z',
            progressCount: 1,
            canRequest: false,
            canCancel: true,
          },
        }}
        onCancelUnmatchRequest={onCancelUnmatchRequest}
      />,
    );

    await user.click(screen.getByRole('button', { name: '해제 요청 철회' }));
    await user.click(screen.getByRole('button', { name: '요청 철회하기' }));

    await waitFor(() => expect(onCancelUnmatchRequest).toHaveBeenCalledWith('active-match-1'));
  });

  it('HAS_ACTIVITY에서 통계 그리드와 단일 helper만 표시한다', () => {
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="HAS_ACTIVITY"
        stats={{ sentRequests: 1, receivedRequests: 2, activeChats: 3 }}
      />,
    );

    expect(screen.getByText('보낸 요청')).toBeDefined();
    expect(screen.getByText('받은 요청')).toBeDefined();
    expect(screen.getByText('대화 중')).toBeDefined();
    expect(screen.getByText('생활패턴과 대화를 통해 서로 잘 맞는지 알아가보세요!')).toBeDefined();
    expect(screen.queryByText(/매칭 요청이 없어요/)).toBeNull();
    expect(screen.queryByText(/마음에 드는 룸메 후보/)).toBeNull();
  });

  it('NO_ACTIVITY도 Dynamic Banner 없이 통계와 helper를 보여준다', () => {
    render(<HomeMatchingSummary {...defaultProps} />);

    expect(screen.getByText('보낸 요청')).toBeDefined();
    expect(screen.getByText('받은 요청')).toBeDefined();
    expect(screen.getByText('대화 중')).toBeDefined();
    expect(screen.queryByText(/매칭 요청이 없어요/)).toBeNull();
  });

  it('비활성 상태에서 통계를 숨긴다', () => {
    render(<HomeMatchingSummary {...defaultProps} status="OFF_SEASON" />);
    expect(screen.queryByText('보낸 요청')).toBeNull();
  });

  it('통계 셀 클릭 시 매칭 탭으로 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="HAS_ACTIVITY"
        stats={{ sentRequests: 1, receivedRequests: 0, activeChats: 0 }}
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByRole('button', { name: /보낸 요청/ }));
    expect(onNavigate).toHaveBeenCalledWith('matching', { requestTab: 'sent' });
  });
});
