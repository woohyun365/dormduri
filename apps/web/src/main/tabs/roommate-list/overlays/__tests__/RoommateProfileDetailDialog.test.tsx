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
  dormitoryLabel: '다산관',
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
  it('loading detail은 작은 안내 Card 대신 profile skeleton을 유지한다', () => {
    renderDialog({
      status: 'loading',
      target,
      profile: null,
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    const loading = within(dialog).getByRole('status', {
      name: '테스트 룸메이트 프로필 상세를 불러오는 중',
    });

    expect(loading).toHaveAttribute('data-testid', 'roommate-detail-loading-skeleton');
    expect(dialog).not.toHaveTextContent('상세 정보를 불러오는 중이에요.');
    expect(dialog).not.toHaveTextContent('정상 목록 진입 맥락을 확인한 뒤');
    expect(loading.querySelectorAll('.bg-gray-200').length).toBeGreaterThan(0);
  });

  it('FULL detail은 hero identity, radar, axis list, privacy note를 표시한다', () => {
    renderDialog({
      status: 'success',
      target,
      profile: createPublicProfileFull({ nickname: '감자친구' }),
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(within(dialog).getByRole('heading', { name: '감자친구' })).toBeInTheDocument();
    expect(within(dialog).getByText('상대 프로필')).toBeInTheDocument();
    expect(within(dialog).getByText('프로필 기본 정보')).toBeInTheDocument();
    expect(within(dialog).getByText('닉네임')).toBeInTheDocument();
    expect(within(dialog).getByText('단과대 / 학년')).toBeInTheDocument();
    expect(within(dialog).getByText('MBTI')).toBeInTheDocument();
    expect(within(dialog).queryByText('Display Identity')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('프로필에 표시되는 이름')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('추가 프로필')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('적합도 92점')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('여성')).not.toBeInTheDocument();
    expect(within(dialog).getByText('춘천캠퍼스')).toBeInTheDocument();
    expect(within(dialog).getByText('다산관')).toBeInTheDocument();
    expect(
      within(dialog).getByText(`${new Date().getFullYear() - 2004 + 1}세 (2004년생)`),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/3학년/)).toBeInTheDocument();
    expect(within(dialog).getByText('ENFJ')).toBeInTheDocument();
    expect(dialog.querySelector('#roommate-detail-intro')).toHaveTextContent(
      '아침형 생활패턴이고 조용한 방을 선호해요.',
    );
    expect(within(dialog).getByText('매칭점수 분석')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: '축별 적합도 한눈에 보기' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '축별 적합도' })).toBeInTheDocument();
    expect(within(dialog).getByText('먼저 확인하면 좋은 포인트')).toBeInTheDocument();
    expect(within(dialog).queryByText('생활 리듬 한눈에 보기')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('항목별 상세 비교')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('항목별 상세 비교 목록')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('대화 시작 포인트')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('매칭 요청 전 가볍게 맞춰볼 주제')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('매칭 요청 가능한 상대예요.')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('흡연').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('청소 습관').length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('상대 생활패턴')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('나의 원하는 룸메 조건')).not.toBeInTheDocument();
    expect(within(dialog).getByText('생활패턴 비교')).toBeInTheDocument();
    expect(within(dialog).getByText('생활패턴 적합도 분석 결과')).toBeInTheDocument();
    expect(within(dialog).getByText('색상별 의미:')).toBeInTheDocument();
    expect(within(dialog).getByText('핵심 포인트')).toBeInTheDocument();
    expect(within(dialog).getByText('잘 맞는 부분 / 대화로 맞출 부분')).toBeInTheDocument();
    expect(within(dialog).getByText('잘 안 맞는 부분')).toBeInTheDocument();
    expect(within(dialog).queryByText('대화로 맞출 부분')).not.toBeInTheDocument();
    const legend = within(dialog).getByRole('list', { name: '적합도 색상 안내' });
    expect(within(legend).getByText('조율 가능')).toBeInTheDocument();
    expect(within(legend).getByText('서로 다름')).toBeInTheDocument();
    expect(
      within(dialog).getByText('상세 적합도는 공개 가능한 생활패턴 축만 사용해요.'),
    ).toBeInTheDocument();
    expect(findCompatibilityPrivacyViolations(dialog.textContent ?? '')).toEqual([]);
    expect(dialog).not.toHaveTextContent('entry-token-secret');
  });

  it('score hidden FULL detail은 점수 없이 amber 예외 안내를 표시한다', () => {
    renderDialog({
      status: 'success',
      target,
      profile: createPublicProfileFull({
        exposure: {
          listSummaryVisible: true,
          detailViewable: true,
          canViewFull: true,
          scoreVisible: false,
        },
        matchScore: undefined,
        compatibility: undefined,
      }),
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(dialog).not.toHaveTextContent('적합도 92점');
    expect(dialog).not.toHaveTextContent('매칭점수 분석');
    expect(dialog).toHaveTextContent('서버 오류로 매칭점수를 제공하지 못했어요.');
    expect(dialog).toHaveTextContent('목록을 새로고침해 다시 확인해 주세요.');
  });

  it('과거 매칭 detail은 compatibility snapshot이 없어도 저장 점수를 오류로 오인하지 않는다', () => {
    renderDialog(
      {
        status: 'success',
        target,
        profile: createPublicProfileFull({
          resultRead: { resultReadable: true, context: 'PAST_MATCH_HISTORY' },
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
            unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
          },
          matchScore: 88,
          compatibility: undefined,
        }),
        error: null,
      },
      { title: '당시 상대 프로필', onRefreshList: undefined },
    );

    const dialog = screen.getByRole('dialog', { name: '당시 상대 프로필' });
    expect(dialog).toHaveTextContent('매칭도 88점');
    expect(dialog).toHaveTextContent('세부 적합도 기록은 제공되지 않아요.');
    expect(dialog).not.toHaveTextContent('서버 오류로 매칭점수를 제공하지 못했어요.');
  });

  it('intro는 글자 수가 아니라 렌더링 2줄 초과 여부로 줄이고 버튼으로 inline 확장한다', async () => {
    const viewportWrappedIntro = '아침 준비는 조용히 하고 밤에는 불을 일찍 끄고 싶어요.';
    const originalGetComputedStyle = window.getComputedStyle;
    const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation((elt) => {
      const style = originalGetComputedStyle(elt);
      return {
        ...style,
        lineHeight: '28px',
        getPropertyValue: style.getPropertyValue.bind(style),
      } as CSSStyleDeclaration;
    });
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function getScrollHeight(this: HTMLElement) {
        return this.textContent?.trim() === viewportWrappedIntro ? 84 : 0;
      });

    try {
      renderDialog({
        status: 'success',
        target,
        profile: createPublicProfileFull({ nickname: '짧은소개', intro: viewportWrappedIntro }),
        error: null,
      });

      const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
      const intro = dialog.querySelector('#roommate-detail-intro');
      const expandButton = await within(dialog).findByRole('button', {
        name: '자기소개 더 보기',
      });

      expect(within(dialog).getByText('자기소개')).toBeInTheDocument();
      expect(intro).toHaveTextContent(viewportWrappedIntro);
      expect(intro).toHaveClass('line-clamp-2');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(expandButton);

      expect(intro).not.toHaveClass('line-clamp-2');
      expect(within(dialog).getByRole('button', { name: '자기소개 접기' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    } finally {
      getComputedStyleSpy.mockRestore();
      scrollHeightSpy.mockRestore();
    }
  });

  it('intro가 비어 있는 FULL detail은 기본 안내 문구를 표시한다', () => {
    renderDialog({
      status: 'success',
      target,
      profile: createPublicProfileFull({ nickname: '무소개', intro: '' }),
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(within(dialog).getByRole('heading', { name: '무소개' })).toBeInTheDocument();
    expect(dialog.querySelector('#roommate-detail-intro')).toHaveTextContent('-');
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

  it('action owner가 외부에 있으면 상세 정보만 표시하고 CTA section을 만들지 않는다', () => {
    renderDialog(
      {
        status: 'success',
        target,
        profile: createPublicProfileFull({ nickname: '확정 룸메이트' }),
        error: null,
      },
      {
        showActionSummary: false,
        onStartChat: vi.fn(),
        onReport: vi.fn(),
        onBlock: vi.fn(),
      },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(within(dialog).getByRole('heading', { name: '확정 룸메이트' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: '생활패턴 적합도 분석 결과' }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '대화 화면에서 이어가기' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '신고하기' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '차단하기' })).toBeNull();
  });

  it('pending match request가 있으면 새 요청 CTA 대신 pending 상태 CTA를 표시한다', async () => {
    const onOpenMatchingRequests = vi.fn();
    renderDialog(
      {
        status: 'success',
        target: {
          ...target,
          pendingMatchRequest: {
            id: 'request-received',
            direction: 'RECEIVED',
            label: '매칭 요청을 받은 사용자',
          },
        },
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
      { onOpenMatchingRequests, onRequestMatch: vi.fn() },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(dialog).not.toHaveTextContent('public summary');
    expect(
      within(dialog).queryByRole('button', { name: '매칭 요청 보내기' }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: '받은 요청 확인하기' }));
    expect(onOpenMatchingRequests).toHaveBeenCalledTimes(1);
  });

  it('검색 preflight가 상세 기본 capability보다 엄격하면 요청 CTA를 다시 열지 않는다', () => {
    renderDialog(
      {
        status: 'success',
        target: {
          ...target,
          actions: {
            canBookmark: true,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['MATCH_REQUEST_PENDING_LIMIT_REACHED'],
          },
        },
        profile: createPublicProfileFull({
          actions: {
            canBookmark: true,
            canRequestMatch: true,
            canStartChat: true,
            unavailableReasons: [],
          },
        }),
        error: null,
      },
      { onRequestMatch: vi.fn(), onStartChat: vi.fn() },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(within(dialog).queryByRole('button', { name: '매칭 요청 보내기' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: '대화 화면에서 이어가기' })).toBeEnabled();
  });

  it('시즌 오픈에는 채팅 CTA 대신 연결되지 않은 slate 매칭 요청 안내를 표시한다', () => {
    const onStartChat = vi.fn();
    renderDialog(
      {
        status: 'success',
        target: {
          ...target,
          actions: {
            canBookmark: true,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
          },
        },
        profile: createPublicProfileFull({
          actions: {
            canBookmark: true,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
          },
        }),
        error: null,
      },
      { onStartChat },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(within(dialog).getByRole('button', { name: '매칭 요청 보내기' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      within(dialog).queryByRole('button', { name: '대화 화면에서 이어가기' }),
    ).not.toBeInTheDocument();
    expect(onStartChat).not.toHaveBeenCalled();
  });

  it('direction limit reached target은 상세에서 매칭 요청 CTA를 amber blocked 상태로 표시한다', () => {
    const onRequestMatch = vi.fn();
    const onStartChat = vi.fn();
    renderDialog(
      {
        status: 'success',
        target,
        profile: createPublicProfileFull({
          id: 'target-direction-limit',
          nickname: '횟수초과',
          actions: {
            canBookmark: true,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
          },
        }),
        error: null,
      },
      { onRequestMatch, onStartChat },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(dialog).toHaveTextContent(
      '이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요',
    );
    expect(within(dialog).getByRole('button', { name: '매칭 요청 횟수 초과' })).toBeDisabled();
    expect(
      within(dialog).queryByRole('button', { name: '매칭 요청 보내기' }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: '대화 화면에서 이어가기' }),
    ).not.toBeInTheDocument();
    expect(onRequestMatch).not.toHaveBeenCalled();
    expect(onStartChat).not.toHaveBeenCalled();
  });

  it('TOMBSTONE detail은 사용자 친화적인 예외 안내만 표시하고 compatibility를 렌더링하지 않는다', () => {
    renderDialog({
      status: 'success',
      target,
      profile: createPublicProfileTombstone({
        tombstone: {
          reason: 'TARGET_NO_LONGER_DISCOVERABLE',
          displayName: '하린',
          message: '상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.',
        },
      }),
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    expect(dialog).toHaveTextContent('상대가 시즌 참여를 철회했어요.');
    expect(dialog).toHaveTextContent('상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.');
    expect(dialog).toHaveTextContent('목록을 새로고침해 현재 참여 중인 후보만 다시 확인해 주세요.');
    expect(dialog).not.toHaveTextContent('다음 행동');
    expect(dialog).not.toHaveTextContent('retained payload');
    expect(dialog).not.toHaveTextContent('매칭점수 분석');
    expect(dialog).not.toHaveTextContent('축별 적합도');
  });

  it('retryable detail error의 다시 시도는 현재 detail target retry를 호출한다', async () => {
    const onRetry = vi.fn();
    renderDialog(
      {
        status: 'error',
        target,
        profile: null,
        error: createRoommateApiError({
          code: 'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID',
          status: 502,
        }),
      },
      { onRetry },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    await userEvent.click(within(dialog).getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('TOMBSTONE detail의 목록 새로고침은 list refresh를 호출한다', async () => {
    const onRefreshList = vi.fn();
    renderDialog(
      {
        status: 'success',
        target,
        profile: createPublicProfileTombstone({
          tombstone: {
            reason: 'TARGET_NO_LONGER_DISCOVERABLE',
            displayName: '하린',
            message: '상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.',
          },
        }),
        error: null,
      },
      { onRefreshList },
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });
    await userEvent.click(within(dialog).getByRole('button', { name: '목록 새로고침' }));
    expect(onRefreshList).toHaveBeenCalledTimes(1);
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
    expect(dialog).toHaveTextContent('서버 오류로 프로필 접근에 실패했어요.');
    expect(dialog).toHaveTextContent('목록을 새로고침한 뒤 다시 열람해 주세요.');
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
