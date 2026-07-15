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
  it('0/2 상태와 영향 고지를 거쳐 해제 요청을 실행한다', async () => {
    const user = userEvent.setup();
    render(<ActiveMatchSection activeMatch={activeMatch()} readOnly={false} commands={commands} />);

    expect(screen.getByText('0/2')).toBeInTheDocument();
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

    expect(screen.getByText('1/2')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: '내 해제 요청 철회' }));
    expect(
      screen.getByRole('dialog', { name: '내 매칭 해제 요청을 철회할까요?' }),
    ).toHaveTextContent('현재 매칭 관계는 그대로 유지돼요');
  });

  it('POST_MATCH read-only variant는 unmatch control을 생성하지 않고 profile/chat capability만 유지한다', () => {
    render(<ActiveMatchSection activeMatch={activeMatch()} readOnly onNavigateChat={vi.fn()} />);

    expect(screen.getByRole('button', { name: '도윤 프로필 상세 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '채팅하기' })).toBeInTheDocument();
    expect(screen.queryByText('매칭 해제 동의')).not.toBeInTheDocument();
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

    expect(screen.getByRole('heading', { level: 3, name: longName })).toHaveClass(
      'wrap-break-word',
    );
    expect(screen.getByText(/상대가 해제를 요청했어요/)).toHaveClass('wrap-break-word');
  });
});
