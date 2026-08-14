import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { MatchingTabView } from '../MatchingTab';
import {
  createMatchingRequest,
  createMatchingRequestSection,
  createSeasonMatchingCurrent,
  matchingSeasonStory,
} from './matching-season-story-fixtures';
import { offSeasonHistoryContent } from './matching-off-season-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Current/No Match',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'ACTIVE 관계가 없는 현재 시즌의 empty·보낸 요청·받은 요청 조합을 production 화면으로 확인합니다. mutation 결과는 Action nested story에서 분리해 검증합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type SeasonMatchingCurrentStory = StoryObj<typeof MatchingTabView>;

export const NoMatchingActivity: SeasonMatchingCurrentStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent(),
    },
    'season-matching:empty',
    { pastContent: offSeasonHistoryContent() },
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /2인실 매칭 안내/ }));
    await expect(canvas.getByRole('list', { name: '2인실 매칭 단계' })).toBeVisible();
    await expect(canvas.getByText('보낸 요청은 동시 3건까지')).toBeVisible();
    await expect(canvas.getByText('채팅으로 먼저 대화하기')).toBeVisible();
  },
};

const sentRequest = createMatchingRequest('sent-1', 'SENT', {
  nickname: '지우',
  score: 92,
  canStartChat: true,
});

export const SentRequest: SeasonMatchingCurrentStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([sentRequest]),
      }),
    },
    'season-matching:sent-request',
    { initialRequestTab: 'sent', pastContent: offSeasonHistoryContent() },
    {
      profileByTargetUserId: {
        [sentRequest.counterpartUserId]: createPublicProfileFull({
          id: sentRequest.counterpartUserId,
          nickname: sentRequest.nickname,
          relation: { type: 'GENERAL' },
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
            unavailableReasons: ['MATCH_REQUEST_ALREADY_PENDING'],
          },
          resultRead: { resultReadable: false, context: 'NONE' },
        }),
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '지우 프로필 상세 보기' }));
    await expect(canvas.getByRole('dialog', { name: '요청 상대 프로필' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '생활패턴 적합도 분석 결과' })).toBeVisible();
  },
};

const receivedRequestContentMatrix = [
  createMatchingRequest('received-intro-note', 'RECEIVED', {
    nickname: '민수',
    facts: [
      { label: '흡연 여부', value: '비흡연' },
      { label: '잠버릇', value: '잠버릇 없음' },
      { label: '관계', value: '각자 생활해요' },
    ],
    intro: '생활 리듬을 존중하며 조용하게 지내고 싶어요.',
    note: '함께 지내고 싶어 요청을 보냈어요.',
    score: 96,
    canStartChat: true,
    hasActiveChatThread: true,
    expiresAt: '2026-08-04T03:00:00.000Z',
  }),
  createMatchingRequest('received-intro-only', 'RECEIVED', {
    nickname: '서윤',
    facts: [
      { label: '흡연 여부', value: '전자담배' },
      { label: '잠버릇', value: '잠버릇 있음' },
      { label: '관계', value: '친하게 지내요' },
    ],
    intro: '공용 공간은 깔끔하게 사용하고 취침 시간을 서로 배려하고 싶어요.',
    note: null,
    score: 88,
    canStartChat: true,
    expiresAt: '2026-08-06T03:00:00.000Z',
  }),
  createMatchingRequest('received-note-only', 'RECEIVED', {
    nickname: '하람',
    facts: [
      { label: '흡연 여부', value: '비흡연' },
      { label: '잠버릇', value: '잠버릇 있음' },
      { label: '관계', value: '친하게 지내요' },
    ],
    intro: '',
    note: '먼저 대화해보고 생활 규칙을 맞춰보고 싶어요.',
    score: 81,
    canStartChat: true,
    expiresAt: '2026-08-03T03:00:00.000Z',
  }),
  createMatchingRequest('received-empty-content', 'RECEIVED', {
    nickname: '지호',
    facts: [
      { label: '흡연 여부', value: '비흡연' },
      { label: '잠버릇', value: '잠버릇 없음' },
      { label: '관계', value: '각자 생활해요' },
    ],
    intro: '',
    note: null,
    score: 74,
    canStartChat: true,
    expiresAt: '2026-08-05T03:00:00.000Z',
  }),
] as const;

export const ReceivedRequest: SeasonMatchingCurrentStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([], receivedRequestContentMatrix),
      }),
    },
    'season-matching:received-request',
    { pastContent: offSeasonHistoryContent() },
  ),
  play: async ({ canvas, userEvent }) => {
    const requestPanel = within(canvas.getByRole('tabpanel', { name: /받은 요청 4/ }));
    const cardHeadings = () =>
      requestPanel.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

    await expect(cardHeadings()).toEqual(['하람', '민수', '지호', '서윤']);
    await userEvent.click(canvas.getByRole('button', { name: '매칭도순' }));
    await expect(cardHeadings()).toEqual(['민수', '서윤', '하람', '지호']);
    await userEvent.click(canvas.getByRole('button', { name: '만료일순' }));
    await expect(cardHeadings()).toEqual(['하람', '민수', '지호', '서윤']);
  },
};
