import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createPublicProfileFull,
  createPublicProfileTombstone,
} from '@/test/home-profile-detail-fixtures';
import { createRoommateApiError } from '../../api/roommateApiErrors';
import type { RoommateProfileDetailState } from '../../hooks/useRoommateProfileDetail';
import { findCompatibilityPrivacyViolations } from '../../model/compatibility/compatibilityPrivacy.policy';
import { RoommateProfileDetailDialog } from '../RoommateProfileDetailDialog';

const target = {
  targetUserId: 'target-1',
  nickname: '테스트 룸메이트',
  detailEntryToken: 'entry-token-secret',
};

function renderDialog(state: RoommateProfileDetailState, overrides = {}) {
  return render(
    <RoommateProfileDetailDialog
      state={state}
      onClose={vi.fn()}
      onRetry={vi.fn()}
      onRefreshList={vi.fn()}
      {...overrides}
    />,
  );
}

describe('RoommateProfileDetailDialog', () => {
  it('FULL detail은 score badge, radar, axis list, public rows, privacy note를 표시한다', () => {
    renderDialog({
      status: 'success',
      target,
      profile: createPublicProfileFull({ nickname: '감자친구' }),
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(within(dialog).getByRole('heading', { name: '감자친구' })).toBeInTheDocument();
    expect(within(dialog).getByText('적합도 92점')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '적합도 한눈에 보기' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '축별 적합도' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('흡연').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('청소').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('공개 생활패턴')).toBeInTheDocument();
    expect(within(dialog).getByText(/민감 항목이나 상대의 룸메 조건 원본값/)).toBeInTheDocument();
    expect(findCompatibilityPrivacyViolations(dialog.textContent ?? '')).toEqual([]);
    expect(dialog).not.toHaveTextContent('entry-token-secret');
  });

  it('FULL detail action CTA는 token 없이 action target snapshot만 전달한다', async () => {
    const onRequestMatch = vi.fn();
    const onReport = vi.fn();
    const onBlock = vi.fn();
    renderDialog(
      {
        status: 'success',
        target,
        profile: createPublicProfileFull({
          id: 'target-action',
          nickname: '액션친구',
          actions: {
            canBookmark: true,
            canRequestMatch: true,
            canStartChat: false,
            unavailableReasons: [],
          },
        }),
        error: null,
      },
      { onRequestMatch, onReport, onBlock },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    await userEvent.click(within(dialog).getByRole('button', { name: '매칭 요청 보내기' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '신고하기' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '차단하기' }));

    expect(onRequestMatch).toHaveBeenCalledWith({
      targetUserId: 'target-action',
      nickname: '액션친구',
      actions: {
        canBookmark: true,
        canRequestMatch: true,
        canStartChat: false,
        unavailableReasons: [],
      },
    });
    expect(onReport.mock.calls[0]?.[0]).not.toHaveProperty('detailEntryToken');
    expect(onBlock.mock.calls[0]?.[0]).toMatchObject({ targetUserId: 'target-action' });
    expect(dialog).not.toHaveTextContent('entry-token-secret');
  });

  it('TOMBSTONE detail은 tombstone message만 표시하고 compatibility를 렌더링하지 않는다', () => {
    renderDialog({
      status: 'success',
      target,
      profile: createPublicProfileTombstone(),
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(dialog).toHaveTextContent('현재는 상대 프로필 상세 정보를 볼 수 없어요.');
    expect(dialog).toHaveTextContent('상대 정보가 더 이상 제공되지 않아요.');
    expect(dialog).not.toHaveTextContent('적합도 한눈에 보기');
    expect(dialog).not.toHaveTextContent('축별 적합도');
  });

  it('404/probing error는 generic copy와 list refresh CTA로 닫는다', async () => {
    const onRefreshList = vi.fn();
    renderDialog(
      {
        status: 'error',
        target,
        profile: null,
        error: createRoommateApiError({ code: 'PROFILE_NOT_VISIBLE', status: 404 }),
      },
      { onRefreshList },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(dialog).toHaveTextContent('상세 정보를 다시 확인할 수 없어요.');
    expect(dialog).toHaveTextContent('대상 존재 여부나 숨김 사유는 추가로 표시하지 않아요.');
    expect(dialog).not.toHaveTextContent('PROFILE_NOT_VISIBLE');

    await userEvent.click(within(dialog).getByRole('button', { name: '목록 새로고침' }));
    expect(onRefreshList).toHaveBeenCalledTimes(1);
  });

  it('Escape close와 focus restore를 지원한다', async () => {
    const onClose = vi.fn();
    const successState: RoommateProfileDetailState = {
      status: 'success',
      target,
      profile: createPublicProfileFull(),
      error: null,
    };
    const closedState: RoommateProfileDetailState = {
      status: 'closed',
      target: null,
      profile: null,
      error: null,
    };
    const { rerender } = render(
      <>
        <button type="button">상세 열기 트리거</button>
        <RoommateProfileDetailDialog
          state={closedState}
          onClose={onClose}
          onRetry={vi.fn()}
          onRefreshList={vi.fn()}
        />
      </>,
    );
    const trigger = screen.getByRole('button', { name: '상세 열기 트리거' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(
      <>
        <button type="button">상세 열기 트리거</button>
        <RoommateProfileDetailDialog
          state={successState}
          onClose={onClose}
          onRetry={vi.fn()}
          onRefreshList={vi.fn()}
        />
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    await waitFor(() => expect(dialog).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <button type="button">상세 열기 트리거</button>
        <RoommateProfileDetailDialog
          state={closedState}
          onClose={onClose}
          onRetry={vi.fn()}
          onRefreshList={vi.fn()}
        />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '상세 열기 트리거' })).toHaveFocus(),
    );
  });
});
