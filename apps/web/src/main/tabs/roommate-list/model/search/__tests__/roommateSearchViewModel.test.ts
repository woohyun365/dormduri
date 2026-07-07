import { describe, expect, it } from 'vitest';
import {
  mapBookmarkListItemToCardViewModel,
  mapRoommateSearchItemToCardViewModel,
} from '../roommateSearchViewModel';
import { createSummary } from './roommateSearchTestFixtures';

function summary(overrides: Partial<ReturnType<typeof createSummary>> = {}) {
  return {
    ...createSummary('participant-vm'),
    ...overrides,
  };
}

describe('roommateSearchViewModel', () => {
  it('scoreVisible=true이고 matchScore가 있으면 score label을 만든다', () => {
    const vm = mapRoommateSearchItemToCardViewModel(summary({ matchScore: 88 }));

    expect(vm.scoreLabel).toBe('매칭점수 88점');
  });

  it('scoreVisible=false인 detail-viewable 예외는 amber score error label로 만든다', () => {
    const item = createSummary('score-hidden');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      exposure: { ...item.exposure, scoreVisible: false },
      matchScore: 91,
    });

    expect(vm.scoreLabel).toBe('서버 오류');
  });

  it('summary-only scoreVisible=false는 score label을 만들지 않는다', () => {
    const item = createSummary('score-hidden-summary-only');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      exposure: {
        ...item.exposure,
        detailViewable: false,
        canViewFull: false,
        scoreVisible: false,
      },
      matchScore: 91,
    });

    expect(vm.scoreLabel).toBeNull();
  });

  it('detail exposure가 닫히면 summary-only state로 변환한다', () => {
    const item = createSummary('summary-only');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      exposure: { ...item.exposure, detailViewable: false, canViewFull: false },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['DIFFERENT_DORMITORY'],
      },
    });

    expect(vm.summaryOnly).toBe(true);
    expect(vm.detailViewable).toBe(false);
    expect(vm.profileVisibilityBadge).toBeNull();
    expect(vm.actionStateLabel).toBe('다른 건물 유저는 프로필 요약만 확인 가능해요');
    expect(vm.actionStateBadges).toEqual([
      { label: '다른 건물 유저는 프로필 요약만 확인 가능해요', tone: 'slate' },
    ]);
  });

  it('summary-only campus preview는 카드 맥락 label을 캠퍼스명으로 표시할 수 있다', () => {
    const item = createSummary('campus-preview');
    const vm = mapRoommateSearchItemToCardViewModel(
      {
        ...item,
        exposure: { ...item.exposure, detailViewable: false, canViewFull: false },
      },
      { summaryContextLabel: '춘천캠퍼스' },
    );

    expect(vm.metadataLabel).toBe('춘천캠퍼스');
  });

  it('detail-viewable search card도 카드 맥락 label을 우선 표시한다', () => {
    const vm = mapRoommateSearchItemToCardViewModel(createSummary('same-dorm'), {
      summaryContextLabel: '예지원 (여)',
    });

    expect(vm.metadataLabel).toBe('예지원 (여)');
  });

  it('result-read context와 bookmark/detail token을 보존한다', () => {
    const item = createSummary('result-read');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
      bookmark: { bookmarked: true, bookmarkedAt: '2026-07-06T00:00:00.000Z' },
      detailEntryToken: 'detail-entry-token-safe',
    });

    expect(vm.resultReadLabel).toBe('현재 매칭 결과 읽기');
    expect(vm.bookmarked).toBe(true);
    expect(vm.targetUserId).toBe('result-read');
    expect(vm.bookmarkAction?.accessibilityLabel).toBe('테스트-result-read 관심 목록 해제');
    expect(vm.detailEntryToken).toBe('detail-entry-token-safe');
  });

  it('resultReadable=false이면 context가 있어도 result-read badge를 만들지 않는다', () => {
    const item = createSummary('result-read-closed');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      resultRead: { resultReadable: false, context: 'CURRENT_MATCHED_PARTNER' },
    });

    expect(vm.resultReadLabel).toBeNull();
  });

  it('canStartChat=true이면 카드용 대화 CTA view model을 만든다', () => {
    const item = createSummary('chat-open');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: true,
        unavailableReasons: [],
      },
    });

    expect(vm.actionStateLabel).toBe('대화 가능');
    expect(vm.actionStateBadges).toEqual([
      { label: '대화 가능', tone: 'green' },
      { label: '매칭 신청 불가', tone: 'amber' },
    ]);
    expect(vm.chatAction).toEqual({
      visible: true,
      label: '채팅하기',
      accessibilityLabel: '테스트-chat-open 채팅하기',
    });
  });

  it('profileSummary allowlist 기반 fact만 만들고 전자담배를 별도 pill로 표시한다', () => {
    const item = createSummary('facts');
    const vm = mapRoommateSearchItemToCardViewModel({
      ...item,
      profileSummary: {
        ...item.profileSummary,
        smokingBehavior: 'E_CIG',
        sleepHabit: 'SNORING',
        relationshipStyle: 'CLOSE',
      },
    });

    expect(vm.facts).toEqual([
      { label: '흡연 여부', value: '전자담배' },
      { label: '잠버릇', value: '잠버릇 있음' },
      { label: '관계', value: '친하게 지내요' },
    ]);
    expect(vm.facts.map((fact) => fact.label)).not.toContain('음주');
  });

  it('bookmark owner item은 targetUserId 기준 card VM으로 변환하고 hidden reason을 노출하지 않는다', () => {
    const vm = mapBookmarkListItemToCardViewModel({
      id: 'bookmark-1',
      targetUserId: 'target-user-1',
      targetParticipantId: 'participant-1',
      bookmarkedAt: '2026-07-06T00:00:00.000Z',
      visibility: 'NO_LONGER_VISIBLE',
      profileSummary: null,
      matchScore: null,
    });

    expect(vm.targetUserId).toBe('target-user-1');
    expect(vm.nickname).toBe('저장한 룸메이트');
    expect(vm.intro).toBe('저장한 항목이 현재 정책상 보이지 않아요.');
    expect(vm.detailEntryToken).toBeNull();
    expect(vm.bookmarkAction?.accessibilityLabel).toBe('저장한 룸메이트 관심 목록 해제');
  });
});
