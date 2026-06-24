import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UrgentActionBanner } from '../components/UrgentActionBanner';
import type { MatchRequest } from '@/types/match';
import type { RoommateProfile } from '@/types/profile';

const USER_ID = 'user-001';

const profiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: '4',
    nickname: '산들바람',
    gender: 'F',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: {} as RoommateProfile['lifestyle'],
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

const baseRequest = {
  message: null,
  rejectedAt: null,
  acceptedAt: null,
  resolvedAt: null,
};

describe('UrgentActionBanner', () => {
  it('24h 이내 만료 받은 요청을 표시한다', () => {
    const requests: MatchRequest[] = [
      {
        id: 'r-urgent',
        fromUserId: '4',
        toUserId: USER_ID,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        ...baseRequest,
      },
    ];
    render(
      <UrgentActionBanner
        matchRequests={requests}
        userId={USER_ID}
        profiles={profiles}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/산들바람님의 요청이 곧 만료돼요/)).toBeDefined();
    expect(screen.getByText(/시간 후 만료/)).toBeDefined();
  });

  it('24h 초과 만료 요청은 표시하지 않는다', () => {
    const requests: MatchRequest[] = [
      {
        id: 'r-far',
        fromUserId: '4',
        toUserId: USER_ID,
        status: 'PENDING',
        createdAt: '2099-01-01T00:00:00.000Z',
        expiresAt: '2099-01-06T00:00:00.000Z',
        ...baseRequest,
      },
    ];
    const { container } = render(
      <UrgentActionBanner
        matchRequests={requests}
        userId={USER_ID}
        profiles={profiles}
        onNavigate={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('이미 만료된 요청은 표시하지 않는다', () => {
    const requests: MatchRequest[] = [
      {
        id: 'r-expired',
        fromUserId: '4',
        toUserId: USER_ID,
        status: 'PENDING',
        createdAt: '2020-01-01T00:00:00.000Z',
        expiresAt: '2020-01-06T00:00:00.000Z',
        ...baseRequest,
      },
    ];
    const { container } = render(
      <UrgentActionBanner
        matchRequests={requests}
        userId={USER_ID}
        profiles={profiles}
        onNavigate={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('보낸 요청은 표시하지 않는다 (받은 요청만)', () => {
    const requests: MatchRequest[] = [
      {
        id: 'r-sent',
        fromUserId: USER_ID,
        toUserId: '4',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        ...baseRequest,
      },
    ];
    const { container } = render(
      <UrgentActionBanner
        matchRequests={requests}
        userId={USER_ID}
        profiles={profiles}
        onNavigate={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('클릭 시 매칭 탭으로 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const requests: MatchRequest[] = [
      {
        id: 'r-urgent',
        fromUserId: '4',
        toUserId: USER_ID,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        ...baseRequest,
      },
    ];
    render(
      <UrgentActionBanner
        matchRequests={requests}
        userId={USER_ID}
        profiles={profiles}
        onNavigate={onNavigate}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(onNavigate).toHaveBeenCalledWith('matching');
  });
});
