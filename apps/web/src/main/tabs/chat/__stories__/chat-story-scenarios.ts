import type {
  ConversationThreadDetailResponse,
  ConversationThreadListResponse,
  ConversationThreadSummary,
} from '@repo/shared/chat';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';

export type ChatStoryAutoOpen = 'thread-detail' | 'report-dialog';

export interface ChatStoryScenario {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly seasonContext: SeasonContextValue;
  readonly list: ConversationThreadListResponse;
  readonly details: Readonly<Record<string, ConversationThreadDetailResponse>>;
  readonly pages?: Readonly<Record<string, ConversationThreadListResponse>>;
  readonly listError?: { readonly status: number; readonly code: string };
  readonly pageError?: { readonly status: number; readonly code: string };
  readonly autoOpen?: ChatStoryAutoOpen;
}

const viewerId = 'chat-story-viewer';
const seasonId = 'season-2026-2';

function seasonContext(state: SeasonContextValue['state']): SeasonContextValue {
  return {
    season: { name: '2026년 2학기', roomSelectionDate: '2026-08-10' },
    state,
    isOpen: state === 'SEASON_OPEN',
    isMatching: state === 'SEASON_MATCHING',
    daysUntilEnd: state === 'OFF_SEASON' ? 0 : 7,
  };
}

function thread(overrides: Partial<ConversationThreadSummary> = {}): ConversationThreadSummary {
  return {
    id: 'thread-story-1',
    seasonId,
    counterpartUserId: 'chat-story-counterpart',
    counterpartParticipantId: 'chat-story-participant',
    threadKind: 'DIRECT',
    status: 'OPEN',
    closedReason: null,
    closedAt: null,
    lastMessageAt: '2026-08-04T03:00:00.000Z',
    canSendMessage: true,
    sendMessageUnavailableReason: null,
    canReport: true,
    ...overrides,
  };
}

function detail(value: ConversationThreadSummary): ConversationThreadDetailResponse {
  return {
    thread: value,
    messages: [
      {
        id: `message-${value.id}`,
        senderUserId: value.counterpartUserId,
        body: '채팅 owner contract로 제공되는 대화 내용이에요.',
        bodyState: 'PLAIN',
        tombstoneReason: null,
        bodyVersion: 1,
        sentAt: '2026-08-04T03:00:00.000Z',
      },
    ],
  };
}

function scenario(
  input: Omit<ChatStoryScenario, 'details'> & {
    readonly details?: Readonly<Record<string, ConversationThreadDetailResponse>>;
  },
): ChatStoryScenario {
  const details =
    input.details ?? Object.fromEntries(input.list.items.map((item) => [item.id, detail(item)]));
  return { ...input, details };
}

const archived = thread({
  id: 'thread-archived',
  status: 'ARCHIVED',
  closedReason: 'SEASON_ENDED',
  closedAt: '2026-07-01T00:00:00.000Z',
  canSendMessage: false,
  sendMessageUnavailableReason: 'ARCHIVED_THREAD',
});
const directOpen = thread();
const directCutoff = thread({
  id: 'thread-direct-cutoff',
  status: 'READ_ONLY',
  closedReason: 'ROOM_SELECTION_CUTOFF',
  closedAt: '2026-08-10T00:00:00.000Z',
  canSendMessage: false,
  sendMessageUnavailableReason: 'THREAD_READ_ONLY',
});
const matchedOpen = thread({ id: 'thread-matched', threadKind: 'MATCHED' });

export const chatStoryScenarios = {
  offSeasonArchived: scenario({
    key: 'off-season-archived',
    title: '지난 대화만 있음',
    description:
      '비시즌에는 현재 활동 thread 없이 archived history만 읽을 수 있는 상태를 보여줍니다.',
    seasonContext: seasonContext('OFF_SEASON'),
    list: { items: [archived], pageInfo: { hasNextPage: false, nextCursor: null } },
  }),
  offSeasonEmpty: scenario({
    key: 'off-season-empty',
    title: '대화 없음',
    description: '현재 또는 보관 대화가 없는 비시즌 empty state입니다.',
    seasonContext: seasonContext('OFF_SEASON'),
    list: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
  }),
  seasonOpenDirect: scenario({
    key: 'season-open-direct',
    title: 'direct 대화 가능',
    description: 'SEASON_OPEN에서 chat owner가 OPEN direct thread 쓰기를 허용한 상태입니다.',
    seasonContext: seasonContext('SEASON_OPEN'),
    list: { items: [directOpen], pageInfo: { hasNextPage: false, nextCursor: null } },
    autoOpen: 'thread-detail',
  }),
  seasonMatchingDirect: scenario({
    key: 'season-matching-direct',
    title: 'direct 대화 가능',
    description:
      'SEASON_MATCHING의 OPEN direct thread입니다. 권한은 thread capability가 소유합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: { items: [directOpen], pageInfo: { hasNextPage: false, nextCursor: null } },
  }),
  seasonMatchingDirectCutoff: scenario({
    key: 'season-matching-direct-cutoff',
    title: 'direct cutoff 읽기 전용',
    description:
      '캠퍼스 시즌이 매칭 중이어도 direct thread는 roomSelection cutoff 뒤 read-only일 수 있습니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: { items: [directCutoff], pageInfo: { hasNextPage: false, nextCursor: null } },
    autoOpen: 'thread-detail',
  }),
  seasonMatchingMatched: scenario({
    key: 'season-matching-matched',
    title: '확정 pair 대화 가능',
    description: '확정된 pair의 OPEN thread는 matched capability로 표시합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: { items: [matchedOpen], pageInfo: { hasNextPage: false, nextCursor: null } },
    autoOpen: 'thread-detail',
  }),
  seasonMatchingPagination: scenario({
    key: 'season-matching-pagination',
    title: 'owner cursor 페이지네이션',
    description: '다음 목록은 owner nextCursor를 그대로 사용하며 client offset을 만들지 않습니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: {
      items: [directOpen],
      pageInfo: { hasNextPage: true, nextCursor: 'chat-story-cursor-2' },
    },
    pages: {
      'chat-story-cursor-2': {
        items: [matchedOpen],
        pageInfo: { hasNextPage: false, nextCursor: null },
      },
    },
  }),
  seasonMatchingReport: scenario({
    key: 'season-matching-report',
    title: 'thread 신고',
    description:
      'canReport thread는 social-safety CHAT_THREAD report contract로만 신고를 접수합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: { items: [directOpen], pageInfo: { hasNextPage: false, nextCursor: null } },
    autoOpen: 'report-dialog',
  }),
  postMatchMatchedOpen: scenario({
    key: 'post-match-matched-open',
    title: 'matched pair 쓰기 유지',
    description:
      'SEASON_POST_MATCH에도 seasonEndDate 전 matched pair OPEN thread는 쓰기를 유지할 수 있습니다.',
    seasonContext: seasonContext('SEASON_POST_MATCH'),
    list: { items: [matchedOpen], pageInfo: { hasNextPage: false, nextCursor: null } },
    autoOpen: 'thread-detail',
  }),
  postMatchReadOnlyHistory: scenario({
    key: 'post-match-read-only-history',
    title: '읽기 전용과 보관 이력',
    description: '현재 read-only thread와 archived history를 함께 표시하는 post-match 상태입니다.',
    seasonContext: seasonContext('SEASON_POST_MATCH'),
    list: { items: [directCutoff, archived], pageInfo: { hasNextPage: false, nextCursor: null } },
  }),
  systemListError: scenario({
    key: 'system-list-error',
    title: '목록 오류 복구',
    description: 'raw upstream detail 없이 안전한 목록 오류와 retry copy를 보여줍니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
    listError: { status: 503, code: 'CHAT_UNAVAILABLE' },
  }),
  systemMemberUnavailable: scenario({
    key: 'system-member-unavailable',
    title: 'member unavailable detail',
    description:
      'member/visibility owner가 write를 닫으면 composer는 capability대로 fail-close합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    list: {
      items: [thread({ canSendMessage: false, sendMessageUnavailableReason: 'MEMBER_LEFT' })],
      pageInfo: { hasNextPage: false, nextCursor: null },
    },
    autoOpen: 'thread-detail',
  }),
} satisfies Record<string, ChatStoryScenario>;

export { viewerId };
