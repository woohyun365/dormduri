import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { MatchingTabView } from '../MatchingTab';
import {
  createCurrentActivity,
  createCurrentActivityEntry,
  createMatchingActiveMatch,
  createSeasonMatchingCurrent,
  matchingSeasonStory,
} from './matching-season-story-fixtures';
import { offSeasonHistoryContent } from './matching-off-season-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Current/Matched',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          '현재 ACTIVE 관계가 있으면 요청 관리를 숨기고 확정 상대와 현재 시즌 활동 이력을 중심으로 표시합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

const activePair = createMatchingActiveMatch();
const defaultProfile = createPublicProfileFull();
const activePairNickname = activePair.counterpartNickname ?? '도윤';
const activePairScore = activePair.matchScore ?? 92;
const activePairProfile = createPublicProfileFull({
  id: activePair.counterpartUserId,
  nickname: activePairNickname,
  intro: activePair.counterpartSummary?.profileSummary.intro ?? defaultProfile.intro,
  matchScore: activePairScore,
  compatibility: defaultProfile.compatibility
    ? {
        ...defaultProfile.compatibility,
        overallScore: activePairScore,
      }
    : undefined,
});

export const ActivePair: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({ activeMatch: activePair }),
    },
    'season-matching:active-pair',
    { pastContent: offSeasonHistoryContent(), onNavigateChat: () => undefined },
    {
      profileByTargetUserId: {
        [activePair.counterpartUserId]: activePairProfile,
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '확정된 룸메이트' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: '채팅하기' })).toBeVisible();
    await expect(canvas.getByText('매칭 종료일')).toBeVisible();
    await expect(canvas.getByText('시즌 종료일')).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: '요청 관리' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: '활동 이력' })).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: `${activePairNickname} 프로필 상세 보기` }),
    );
    const dialog = await canvas.findByRole('dialog', { name: '확정된 룸메이트 프로필' });
    await expect(
      within(dialog).getByRole('heading', { name: activePairProfile.nickname }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole('heading', { name: '생활패턴 적합도 분석 결과' }),
    ).toBeVisible();
    await expect(
      within(dialog).queryByRole('button', { name: '대화 화면에서 이어가기' }),
    ).not.toBeInTheDocument();
    await expect(
      within(dialog).queryByRole('button', { name: '신고하기' }),
    ).not.toBeInTheDocument();
    await expect(
      within(dialog).queryByRole('button', { name: '차단하기' }),
    ).not.toBeInTheDocument();
    await expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const ActivityHistory: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        activeMatch: activePair,
        activity: createCurrentActivity([
          createCurrentActivityEntry('rejected', {
            counterpartNickname: '봄날',
            stage: 'RECEIVED_REQUEST',
            direction: 'RECEIVED',
            occurredAt: '2026-08-01T03:00:00.000Z',
          }),
          createCurrentActivityEntry('expired', {
            counterpartNickname: '라온',
            result: 'REQUEST_EXPIRED',
            requestTerminalReason: 'EXPIRED',
            occurredAt: '2026-08-02T03:00:00.000Z',
          }),
          createCurrentActivityEntry('previous-unmatch', {
            counterpartNickname: '여울',
            stage: 'MATCH',
            result: 'UNMATCHED_AFTER_SUCCESS',
            direction: 'RECEIVED',
            requestTerminalReason: 'ACCEPTED',
            activeMatchEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
            occurredAt: '2026-08-03T03:00:00.000Z',
          }),
          createCurrentActivityEntry('current-match', {
            counterpartNickname: '도윤',
            stage: 'MATCH',
            result: 'MATCHED_SUCCESS',
            requestTerminalReason: 'ACCEPTED',
            occurredAt: '2026-08-04T03:00:00.000Z',
          }),
          createCurrentActivityEntry('auto-closed-sent', {
            counterpartNickname: '새봄',
            result: 'REQUEST_CANCELLED',
            requestTerminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
            systemCancellationCause: 'VIEWER_MATCHED',
            systemCancellationGroupId: 'runtime-match-1',
            occurredAt: '2026-08-04T03:00:00.000Z',
          }),
          createCurrentActivityEntry('auto-closed-received', {
            counterpartNickname: '하람',
            stage: 'RECEIVED_REQUEST',
            result: 'REQUEST_CANCELLED',
            direction: 'RECEIVED',
            requestTerminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
            systemCancellationCause: 'VIEWER_MATCHED',
            systemCancellationGroupId: 'runtime-match-1',
            occurredAt: '2026-08-04T03:00:00.000Z',
          }),
        ]),
      }),
    },
    'season-matching:activity',
    { pastContent: offSeasonHistoryContent() },
    {
      profileByTargetUserId: {
        [activePair.counterpartUserId]: activePairProfile,
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '활동 이력' })).toBeVisible();
    await expect(canvas.getByText('매칭 후 해제')).toBeVisible();
    await expect(canvas.getAllByText('매칭 완료')[0]).toBeVisible();
    await userEvent.click(canvas.getByText('요청 2건 자동 종료'));
    await expect(canvas.getByText('새봄')).toBeVisible();
    await expect(canvas.getByText('하람')).toBeVisible();
  },
};

export const PartialCounterpartSummary = matchingSeasonStory(
  {
    kind: 'season-matching',
    current: createSeasonMatchingCurrent({
      activeMatch: createMatchingActiveMatch({
        counterpartSummary: undefined,
        matchScore: undefined,
      }),
    }),
  },
  'season-matching:active-pair',
  { pastContent: offSeasonHistoryContent() },
);
