import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentActiveMatchSummary } from '@repo/shared/match/contract';
import { ActiveMatchSection } from '../ActiveMatchSection';

function activeMatch(
  state: CurrentActiveMatchSummary['unmatchProgress']['state'] = 'NONE',
): CurrentActiveMatchSummary {
  const waitingForMe = state === 'WAITING_FOR_ME';
  const waitingForCounterpart = state === 'WAITING_FOR_COUNTERPART';
  return {
    id: 'active-1',
    seasonId: 'season-1',
    counterpartUserId: 'user-2',
    counterpartParticipantId: 'participant-2',
    counterpartNickname: '도윤',
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
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
      profileSummary: {
        nickname: '도윤',
        intro: '조용히 지내고 싶어요.',
        smokingBehavior: 'NO',
        sleepHabit: null,
        relationshipStyle: null,
      },
      matchScore: 90,
    },
    status: 'ACTIVE',
    startedAt: '2026-08-01T00:00:00.000Z',
    endedAt: null,
    endReason: null,
    createdFromRequestId: 'request-1',
    matchScore: 90,
    unmatchProgress: {
      state,
      requestedByViewerAt: waitingForCounterpart ? '2026-08-02T00:00:00.000Z' : null,
      requestedByCounterpartAt: waitingForMe ? '2026-08-02T00:00:00.000Z' : null,
      progressCount: state === 'NONE' ? 0 : state === 'COMPLETED' ? 2 : 1,
      requiredCount: 2,
      canRequest: state === 'NONE' || waitingForMe,
      canCancel: waitingForCounterpart,
      disabledReason: state === 'COMPLETED' ? 'ACTIVE_MATCH_NOT_ACTIONABLE' : null,
      availableUntil: '2026-08-10T14:59:59.999Z',
    },
  };
}

const commands = {
  requestUnmatch: vi.fn().mockResolvedValue('success'),
  cancelUnmatchRequest: vi.fn().mockResolvedValue('success'),
  isPending: vi.fn().mockReturnValue(false),
};

describe('ActiveMatchSection', () => {
  it('정상 매칭에서는 관계와 주요 행동을 먼저 보여주고 매칭 관리 안에서 해제 요청을 실행한다', async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    render(
      <ActiveMatchSection
        activeMatch={activeMatch()}
        readOnly={false}
        roomSelectionDate="2026-08-10"
        seasonEndDate="2026-08-31"
        commands={commands}
        onNavigateChat={onNavigateChat}
      />,
    );

    expect(screen.getByTestId('matching-active-summary-card')).toHaveAttribute(
      'data-tone',
      'success',
    );
    expect(screen.getByRole('heading', { name: '도윤' })).toBeInTheDocument();
    expect(screen.getByText('매칭 종료일')).toBeInTheDocument();
    expect(screen.getByText('호실 선택일')).toBeInTheDocument();
    expect(screen.getByText('시즌 종료일')).toBeInTheDocument();
    expect(screen.getByText('26. 08. 10.')).toBeInTheDocument();
    expect(screen.getByText('26. 08. 31.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '채팅하기' }));
    expect(onNavigateChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('0/2')).not.toBeInTheDocument();
    const management = screen.getByRole('button', { name: /매칭 관리/ });
    expect(management).toHaveAttribute('aria-expanded', 'false');
    await user.click(management);
    expect(management).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: '매칭 해제 요청' }));
    expect(screen.getByRole('dialog', { name: '매칭 해제를 요청할까요?' })).toHaveTextContent(
      '상대도 동의해야 매칭이 해제돼요',
    );
    await user.click(screen.getByRole('button', { name: '해제 요청하기' }));
    expect(commands.requestUnmatch).toHaveBeenCalledWith('active-1');
  });

  it('상대 요청 1/2는 동의 즉시 해제 copy를 표시한다', async () => {
    const user = userEvent.setup();
    render(
      <ActiveMatchSection
        activeMatch={activeMatch('WAITING_FOR_ME')}
        readOnly={false}
        commands={commands}
      />,
    );

    expect(screen.getByText('동의 1/2')).toBeInTheDocument();
    expect(screen.queryByText('매칭 해제 동의가 필요해요.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('상대가 요청했어요. 매칭 관리에서 확인해 주세요.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('내 응답 필요')).toBeInTheDocument();
    expect(screen.getByText('상대의 이유를 먼저 들어보세요.')).toBeInTheDocument();
    expect(screen.queryByText(/응답 기한/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '매칭 해제에 동의' }));
    expect(screen.getByRole('dialog', { name: '매칭 해제에 동의할까요?' })).toHaveTextContent(
      '즉시 해제돼요',
    );
  });

  it('내 요청 1/2는 내 동의만 철회하는 cancel control을 제공한다', async () => {
    const user = userEvent.setup();
    render(
      <ActiveMatchSection
        activeMatch={activeMatch('WAITING_FOR_COUNTERPART')}
        readOnly={false}
        commands={commands}
      />,
    );

    expect(screen.getByText('상대에게 이유를 설명해 주세요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '내 해제 요청 철회' }));
    expect(
      screen.getByRole('dialog', { name: '내 매칭 해제 요청을 철회할까요?' }),
    ).toHaveTextContent('현재 매칭 관계는 그대로 유지돼요');
  });

  it('호실 선택 cutoff 이후에는 매칭 관리 섹션을 렌더링하지 않는다', () => {
    const cutoffMatch = activeMatch();
    render(
      <ActiveMatchSection
        activeMatch={{
          ...cutoffMatch,
          unmatchProgress: {
            ...cutoffMatch.unmatchProgress,
            canRequest: false,
            disabledReason: 'ROOM_SELECTION_CUTOFF',
          },
        }}
        readOnly={false}
        commands={commands}
      />,
    );

    expect(screen.queryByText('매칭 관리')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '매칭 해제 요청' })).not.toBeInTheDocument();
  });

  it('POST_MATCH read-only variant는 unmatch control을 생성하지 않고 profile/chat capability만 유지한다', () => {
    render(<ActiveMatchSection activeMatch={activeMatch()} readOnly onNavigateChat={vi.fn()} />);

    expect(screen.getByRole('button', { name: '도윤 프로필 상세 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '채팅하기' })).toBeInTheDocument();
    expect(screen.queryByText('매칭 관리')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '매칭 해제 요청' })).not.toBeInTheDocument();
  });

  it('긴 active nickname과 unmatch 안내는 320px reflow utility를 유지한다', () => {
    const longName = '여러 줄로 자연스럽게 표시되어야 하는 아주 긴 확정 룸메이트 닉네임';
    render(
      <div style={{ width: 320 }}>
        <ActiveMatchSection
          activeMatch={{
            ...activeMatch('WAITING_FOR_ME'),
            counterpartNickname: longName,
            counterpartSummary: {
              ...activeMatch('WAITING_FOR_ME').counterpartSummary!,
              profileSummary: {
                ...activeMatch('WAITING_FOR_ME').counterpartSummary!.profileSummary,
                nickname: longName,
              },
            },
          }}
          readOnly={false}
          commands={commands}
        />
      </div>,
    );

    expect(screen.getByRole('heading', { level: 3, name: longName })).toBeInTheDocument();
    expect(screen.getByText('대화 후 해제 여부를 결정해요.')).toBeInTheDocument();
  });
});
