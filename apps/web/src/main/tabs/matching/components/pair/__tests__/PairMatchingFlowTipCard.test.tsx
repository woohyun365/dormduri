import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PairMatchingFlowTipCard } from '../PairMatchingFlowTipCard';

describe('PairMatchingFlowTipCard', () => {
  it('Season Matching ACTIVE에서는 공식 호실 선택 준비를 안내한다', async () => {
    const user = userEvent.setup();
    render(<PairMatchingFlowTipCard requestLimit={3} matched />);

    expect(screen.getByText('채팅 → 공식 일정 → 호실 선택')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /2인실 매칭 안내/ }));

    expect(screen.getByText('채팅으로 일정 조율')).toBeInTheDocument();
    expect(screen.getByText('학교 홈페이지에서 호실 선택')).toBeInTheDocument();
    expect(screen.queryByText(/보낸 요청은 동시/)).not.toBeInTheDocument();
  });

  it('Post Match ACTIVE에서는 호실 선택 대신 활동 정리와 입실 준비를 안내한다', async () => {
    const user = userEvent.setup();
    render(<PairMatchingFlowTipCard phase="post-match" matched />);

    expect(screen.getByText('프로필 확인 → 입실 준비')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /2인실 매칭 안내/ }));

    expect(screen.getByText('나를 살펴보기')).toBeInTheDocument();
    expect(screen.getByText('자신의 생활 습관을 확인해요.')).toBeInTheDocument();
    expect(screen.getByText('상대와 입실 준비')).toBeInTheDocument();
    expect(screen.getByText('학교 입사 안내 확인')).toBeInTheDocument();
    expect(screen.queryByText('학교 홈페이지에서 호실 선택')).not.toBeInTheDocument();
  });

  it('Post Match 미성사 상태에서는 활동을 정리하고 다음 시즌을 준비하도록 안내한다', async () => {
    const user = userEvent.setup();
    render(<PairMatchingFlowTipCard phase="post-match" matched={false} />);

    expect(screen.getByText('활동 확인 → 다음 시즌 준비')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /2인실 매칭 안내/ }));

    expect(screen.getByText('이번 시즌 활동 돌아보기')).toBeInTheDocument();
    expect(screen.getByText('잘 맞는 조건 정리')).toBeInTheDocument();
    expect(screen.getByText('다음 시즌 준비')).toBeInTheDocument();
  });
});
