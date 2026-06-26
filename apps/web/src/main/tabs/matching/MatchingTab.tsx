'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Handshake,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Building2,
  Calendar,
  Flag,
  MessageCircle,
  Archive,
  List,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { UNASSIGNED_ID, isCampusOperated, getMatchGroupSize } from '@/constants/dormitory';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MATCH_POLICY } from '@/constants/match';
import { OverlappedAvatars } from '../../components/matching/OverlappedAvatars';
import { MatchingCompactCard } from '../../components/matching/MatchingCompactCard';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import { MatchingTabHeader } from './MatchingTabHeader';
import { SubNav } from '../../components/matching/SubNav';
import { ActiveMatchCard } from '../../components/matching/ActiveMatchCard';
import { GroupInfoTipCard } from '../../components/matching/GroupInfoTipCard';
import { MatchingEmptyState } from '../../components/matching/MatchingEmptyState';
import { PastSeasonAccordion } from '../../components/matching/PastSeasonAccordion';
import { PolicyHintBanner } from '../../components/matching/PolicyHintBanner';
import { ShowMoreButton } from '../../components/matching/ShowMoreButton';
import { SegmentControl } from '../../components/matching/SegmentControl';
import { SortToggle } from '../../components/matching/SortToggle';
import {
  getCurrentHistoryVisualMeta,
  getRepeatedCancelledVisualMeta,
} from '../../components/matching/historyDisplay';
import { getMatchingPolicyHints } from '../../components/matching/policyCopy';
import type { SortOption } from '../../components/matching/SortToggle';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { doesRequestTargetUser, isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import { matchingHistoryCardBorder, matchingStageBackground } from '@/main/styles/matching';
import type { MatchScoreType } from '@/utils/matchScore';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch, MatchStatus, PastSeasonData } from '@/types/match';

type RequestTab = 'sent' | 'received';
type SubNavTab = 'current' | 'past';

interface CurrentHistoryRow {
  request: MatchRequest;
  partnerNickname: string;
  partnerDormId: string | null;
  aggregateCount?: number;
  aggregateContext?: 'SENT_REQUEST' | 'RECEIVED_REQUEST';
}

const TERMINAL_STATUSES: MatchStatus[] = [
  'EXPIRED',
  'REJECTED',
  'CANCELLED',
  'CONVERSATION_ENDED',
  'UNMATCHED',
];

const INITIAL_SHOW = 3;
const HISTORY_INITIAL_SHOW = 5;

interface MatchingTabProps {
  user: UserProfile;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  pastSeasons: PastSeasonData[];
  onCancelRequest: (requestId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onConfirmMatch: (requestId: string) => void;
  onRevokeConfirmMatch: (requestId: string) => void;
  onFinalizePairGroup: () => void;
  onEndConversation: (requestId: string) => void;
  onEndMatch: () => void;
  onNavigate: (tab: TabId) => void;
  initialSection?: SubNavTab;
  initialRequestTab?: RequestTab;
}

const getPartnerId = (request: MatchRequest, currentUserId: string) =>
  request.fromUserId === currentUserId ? request.toUserId : request.fromUserId;

export default function MatchingTab({
  user,
  matchRequests,
  activeMatch,
  profiles,
  pastSeasons,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onConfirmMatch,
  onRevokeConfirmMatch,
  onFinalizePairGroup: _onFinalizePairGroup,
  onEndConversation,
  onEndMatch,
  onNavigate,
  initialSection,
  initialRequestTab,
}: MatchingTabProps) {
  // --- Hooks ---
  const { state: seasonState, daysUntilEnd } = useSeasonContext();
  const campusOperated = isCampusOperated(user.campus);

  const profileMap = useMemo(() => {
    const map = new Map<string, Omit<RoommateProfile, 'matchScore'>>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const sentPending = useMemo(
    () =>
      matchRequests.filter(
        (r) => r.fromUserId === user.id && r.status === 'PENDING' && !isRequestExpired(r),
      ),
    [matchRequests, user.id],
  );

  const receivedPending = useMemo(
    () =>
      matchRequests.filter(
        (r) => doesRequestTargetUser(r, user.id) && r.status === 'PENDING' && !isRequestExpired(r),
      ),
    [matchRequests, user.id],
  );

  const conversations = useMemo(
    () => matchRequests.filter((r) => r.status === 'IN_CONVERSATION'),
    [matchRequests],
  );

  const history = useMemo(
    () =>
      matchRequests
        .filter((r) => TERMINAL_STATUSES.includes(r.status))
        .sort((a, b) => {
          const aTime = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
          const bTime = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
          return bTime - aTime;
        }),
    [matchRequests],
  );

  // --- UI State ---
  const defaultSubNav: SubNavTab =
    initialSection ?? (seasonState === 'OFF_SEASON' ? 'past' : 'current');
  const [subNavTab, setSubNavTab] = useState<SubNavTab>(defaultSubNav);
  const [requestTab, setRequestTab] = useState<RequestTab>(initialRequestTab ?? 'sent');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type:
      | 'cancel'
      | 'reject'
      | 'accept'
      | 'confirmMatch'
      | 'revokeConfirm'
      | 'endConversation'
      | 'endMatch';
    requestId?: string;
    nickname: string;
  } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<{
    profile: RoommateProfile & { scoreType: MatchScoreType };
    direction: 'sent' | 'received' | 'conversation';
    requestId: string;
  } | null>(null);

  // 더보기 / 정렬 (점진적 3개씩)
  const [convShowCount, setConvShowCount] = useState(INITIAL_SHOW);
  const [recvShowCount, setRecvShowCount] = useState(INITIAL_SHOW);
  const [histShowCount, setHistShowCount] = useState(HISTORY_INITIAL_SHOW);
  const [receivedSort, setReceivedSort] = useState<SortOption>('oldest');
  const [renderedAt] = useState(() => Date.now());

  // 섹션 ref (접기 시 스크롤)
  const convSectionRef = useRef<HTMLElement>(null);
  const recvSectionRef = useRef<HTMLElement>(null);
  const histSectionRef = useRef<HTMLElement>(null);
  const isGroupCoreOpen = activeMatch?.kind === 'group' && activeMatch.groupStage === 'PAIR_OPEN';
  const isGroupForming =
    activeMatch?.kind === 'group' && activeMatch.groupStage === 'GROUP_FORMING';
  const isGroupMatch = activeMatch?.kind === 'group';

  const policyHints = getMatchingPolicyHints({
    seasonState,
    activeMatch,
    sentPendingCount: sentPending.length,
    receivedPendingCount: receivedPending.length,
    conversationsCount: conversations.length,
    daysUntilEnd,
  });

  // --- Helpers ---
  const getPartnerProfile = (
    request: MatchRequest,
  ): RoommateProfile & { scoreType: MatchScoreType } => {
    const partnerId = getPartnerId(request, user.id);
    const p = profileMap.get(partnerId);
    const result = p
      ? calcMatchScoreWithGating(user.lifestyle, p.lifestyle)
      : { score: null, type: 'gated' as const };
    return {
      id: p?.id ?? partnerId,
      nickname: p?.nickname ?? partnerId,
      gender: p?.gender ?? ('M' as const),
      campus: p?.campus ?? ('CHUNCHEON' as const),
      dormitoryId: p?.dormitoryId ?? null,
      lifestyle: p?.lifestyle ?? ({} as RoommateProfile['lifestyle']),
      intro: p?.intro ?? '',
      messageToRoommate: p?.messageToRoommate ?? null,
      additional: p?.additional ?? { college: null, grade: null, mbti: null, birthYear: null },
      matchScore: result.score ?? 0,
      scoreType: result.type,
    };
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    switch (confirmAction.type) {
      case 'cancel':
        if (confirmAction.requestId) onCancelRequest(confirmAction.requestId);
        break;
      case 'reject':
        if (confirmAction.requestId) onRejectRequest(confirmAction.requestId);
        break;
      case 'accept':
        if (confirmAction.requestId) onAcceptRequest(confirmAction.requestId);
        break;
      case 'confirmMatch':
        if (confirmAction.requestId) onConfirmMatch(confirmAction.requestId);
        break;
      case 'revokeConfirm':
        if (confirmAction.requestId) onRevokeConfirmMatch(confirmAction.requestId);
        break;
      case 'endConversation':
        if (confirmAction.requestId) onEndConversation(confirmAction.requestId);
        break;
      case 'endMatch':
        onEndMatch();
        break;
    }
    setSelectedProfile(null);
    setConfirmAction(null);
  };

  const confirmMessages: Record<
    string,
    {
      title: string;
      message: string;
      warning?: string;
      label: string;
      variant: 'default' | 'danger';
    }
  > = {
    cancel: {
      title: '요청 취소',
      message: `${confirmAction?.nickname ?? ''}님에게 보낸 매칭 요청을 취소하시겠습니까?`,
      label: '취소하기',
      variant: 'default',
    },
    reject: {
      title: '요청 거절',
      message: `${confirmAction?.nickname ?? ''}님의 매칭 요청을 거절하시겠습니까?`,
      label: '거절하기',
      variant: 'danger',
    },
    accept: {
      title: isGroupCoreOpen ? '합류 승인' : '요청 수락',
      message: isGroupCoreOpen
        ? `${confirmAction?.nickname ?? ''}님의 합류 요청을 승인하시겠습니까?\n코어 2명이 모두 승인해야 새로운 C 대화가 열립니다.`
        : `${confirmAction?.nickname ?? ''}님의 매칭 요청을 수락하시겠습니까?\n수락 후 대화를 시작할 수 있어요.`,
      label: isGroupCoreOpen ? '승인하기' : '수락하기',
      variant: 'default',
    },
    confirmMatch: {
      title: '매칭 확정 승인',
      message: isGroupForming
        ? `${confirmAction?.nickname ?? ''}님과의 3인 그룹 확정을 승인하시겠습니까?`
        : `${confirmAction?.nickname ?? ''}님과의 매칭을 확정하시겠습니까?`,
      warning: isGroupForming
        ? '3명이 모두 눌러야 최종 매칭이 완료됩니다.'
        : '두 사람 모두 확정해야 매칭이 완료됩니다.',
      label: '승인하기',
      variant: 'default',
    },
    revokeConfirm: {
      title: '확정 완료 취소',
      message: `${confirmAction?.nickname ?? ''}님과의 확정 완료를 취소하시겠습니까?\n다시 대화를 이어가거나 종료할 수 있게 됩니다.`,
      label: '취소하기',
      variant: 'default',
    },
    endConversation: {
      title: '대화 종료',
      message: `${confirmAction?.nickname ?? ''}님과의 대화를 종료하시겠습니까?\n\n종료 후 같은 상대와 재교류할 수 없습니다.`,
      label: '종료하기',
      variant: 'danger',
    },
    endMatch: {
      title: activeMatch?.cancelRequestedAt ? '매칭 취소 승인' : '매칭 취소 요청',
      message: activeMatch?.cancelRequestedAt
        ? `${activeMatch?.partnerNickname ?? ''}님이 매칭 취소를 요청했어요.\n승인하면 매칭이 해제됩니다.`
        : `${activeMatch?.partnerNickname ?? ''}님과의 매칭 취소를 요청하시겠습니까?\n상대가 승인하면 매칭이 해제됩니다.`,
      label: activeMatch?.cancelRequestedAt ? '승인하기' : '취소 요청하기',
      variant: 'danger',
    },
  };

  // 정렬된 받은 요청
  const sortedReceived = useMemo(() => {
    const sorted = [...receivedPending];
    if (receivedSort === 'matchScore') {
      sorted.sort((a, b) => {
        const partnerId = (r: MatchRequest) =>
          r.fromUserId === user.id ? r.toUserId : r.fromUserId;
        const aProfile = profileMap.get(partnerId(a));
        const bProfile = profileMap.get(partnerId(b));
        const aResult = aProfile
          ? calcMatchScoreWithGating(user.lifestyle, aProfile.lifestyle)
          : { score: 0 };
        const bResult = bProfile
          ? calcMatchScoreWithGating(user.lifestyle, bProfile.lifestyle)
          : { score: 0 };
        return (bResult.score ?? 0) - (aResult.score ?? 0);
      });
    } else {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return sorted;
  }, [receivedPending, receivedSort, user.id, user.lifestyle, profileMap]);

  // 더보기 슬라이싱 (점진적)
  const displayedConversations = conversations.slice(0, convShowCount);
  const displayedReceived = sortedReceived.slice(0, recvShowCount);
  const aggregatedHistory = useMemo<CurrentHistoryRow[]>(() => {
    const rows: CurrentHistoryRow[] = [];
    const seen = new Map<string, CurrentHistoryRow>();

    for (const req of history) {
      const partnerId = getPartnerId(req, user.id);
      const partnerNickname = profileMap.get(partnerId)?.nickname ?? partnerId;
      const partnerDormId = profileMap.get(partnerId)?.dormitoryId ?? null;
      const isRepeatedSentCancelled =
        req.status === 'CANCELLED' && req.fromUserId === user.id && req.resolvedBy === user.id;
      const isRepeatedReceivedCancelled =
        req.status === 'CANCELLED' &&
        req.fromUserId !== user.id &&
        req.resolvedBy !== null &&
        req.resolvedBy !== undefined &&
        req.resolvedBy !== 'system' &&
        req.resolvedBy !== user.id;

      if (isRepeatedSentCancelled || isRepeatedReceivedCancelled) {
        const context = isRepeatedSentCancelled ? 'SENT_REQUEST' : 'RECEIVED_REQUEST';
        const key = `cancelled:${context}:${partnerId}`;
        const existing = seen.get(key);
        if (existing) {
          existing.aggregateCount = (existing.aggregateCount ?? 1) + 1;
          continue;
        }
        const row: CurrentHistoryRow = {
          request: req,
          partnerNickname,
          partnerDormId,
          aggregateCount: 1,
          aggregateContext: context,
        };
        seen.set(key, row);
        rows.push(row);
        continue;
      }

      rows.push({ request: req, partnerNickname, partnerDormId });
    }

    return rows;
  }, [history, profileMap, user.id]);
  const displayedHistory = aggregatedHistory.slice(0, histShowCount);

  // 더보기/접기 핸들러
  const handleToggleMore = useCallback(
    (
      total: number,
      current: number,
      initial: number,
      step: number,
      setter: (n: number) => void,
      sectionRef: React.RefObject<HTMLElement | null>,
    ) => {
      if (current >= total) {
        // 접기: 초기 개수로 복귀 + DOM 업데이트 후 smooth scroll
        setter(initial);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      } else {
        // 더보기: step만큼 증가
        setter(Math.min(current + step, total));
      }
    },
    [],
  );

  // --- 공통 UI ---
  const renderDialogs = () => (
    <>
      <ProfileDetailSheet
        profile={selectedProfile?.profile ?? null}
        scoreType={selectedProfile?.profile?.scoreType}
        isOpen={selectedProfile !== null}
        onClose={() => setSelectedProfile(null)}
        onRequestMatch={() => {}}
        hideMatchButton
        userLifestyle={user.lifestyle}
        customFooter={
          selectedProfile ? (
            selectedProfile.direction === 'sent' ? (
              <button
                onClick={() =>
                  setConfirmAction({
                    type: 'cancel',
                    requestId: selectedProfile.requestId,
                    nickname: selectedProfile.profile.nickname,
                  })
                }
                className="w-full py-3 border-2 border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                요청 취소
              </button>
            ) : selectedProfile.direction === 'received' ? (
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setConfirmAction({
                      type: 'reject',
                      requestId: selectedProfile.requestId,
                      nickname: selectedProfile.profile.nickname,
                    })
                  }
                  className="flex-1 py-3 border-2 border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  거절
                </button>
                <button
                  onClick={() =>
                    setConfirmAction({
                      type: 'accept',
                      requestId: selectedProfile.requestId,
                      nickname: selectedProfile.profile.nickname,
                    })
                  }
                  className="flex-1 py-3 bg-[var(--knu-primary)] text-white font-bold rounded-xl hover:bg-[var(--knu-primary-hover)] transition-colors"
                >
                  수락
                </button>
              </div>
            ) : undefined
          ) : undefined
        }
      />
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmAction ? confirmMessages[confirmAction.type]!.title : ''}
        message={confirmAction ? confirmMessages[confirmAction.type]!.message : ''}
        warning={confirmAction ? confirmMessages[confirmAction.type]!.warning : undefined}
        confirmLabel={confirmAction ? confirmMessages[confirmAction.type]!.label : ''}
        variant={confirmAction ? confirmMessages[confirmAction.type]!.variant : 'default'}
      />
    </>
  );

  const renderPastView = () => (
    <motion.div
      key="past"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      {pastSeasons.length > 0 ? (
        pastSeasons.map((season, index) => (
          <PastSeasonAccordion key={season.id} season={season} defaultExpanded={index === 0} />
        ))
      ) : (
        <MatchingEmptyState
          icon={Calendar}
          title="참여한 시즌이 없어요"
          description="다음 시즌에 참여해서 룸메이트를 찾아보세요!"
        />
      )}
    </motion.div>
  );

  // --- 게이팅: NOT_OPERATED ---
  if (!campusOperated) {
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
        <div className="px-5 py-6 max-w-md mx-auto">
          <MatchingEmptyState type="not_operated" icon={Handshake} />
        </div>
      </div>
    );
  }

  // --- 게이팅: SEASON_OPEN ---
  if (seasonState === 'SEASON_OPEN') {
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
        <div className="px-5 py-5 max-w-md mx-auto space-y-5">
          <SubNav
            options={[
              { id: 'current', label: '현재 시즌' },
              { id: 'past', label: '과거 이력' },
            ]}
            selected={subNavTab}
            onChange={(id) => setSubNavTab(id as SubNavTab)}
          />
          {subNavTab === 'current' && <PolicyHintBanner hints={policyHints} />}
          <AnimatePresence mode="wait">
            {subNavTab === 'current' ? (
              <motion.div
                key="current"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <MatchingEmptyState
                  type="season_open"
                  icon={Handshake}
                  action={{ label: '룸메 탐색하러 가기', onClick: () => onNavigate('list') }}
                />
              </motion.div>
            ) : (
              renderPastView()
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // --- 게이팅: OFF_SEASON ---
  if (seasonState === 'OFF_SEASON') {
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
        <div className="px-5 py-5 max-w-md mx-auto space-y-5">
          <SubNav
            options={[
              { id: 'current', label: '현재 시즌' },
              { id: 'past', label: '과거 이력' },
            ]}
            selected={subNavTab}
            onChange={(id) => setSubNavTab(id as SubNavTab)}
          />
          {subNavTab === 'current' && <PolicyHintBanner hints={policyHints} />}
          <AnimatePresence mode="wait">
            {subNavTab === 'current' ? (
              <motion.div
                key="current"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <MatchingEmptyState
                  type="off_season"
                  icon={Handshake}
                  action={{ label: '프로필 완성하러 가기', onClick: () => onNavigate('profile') }}
                />
              </motion.div>
            ) : (
              renderPastView()
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // --- UNASSIGNED 판정 (게이팅은 "현재 시즌" 내부에서만 적용) ---
  const isUnassigned = user.dormitoryId === UNASSIGNED_ID || user.dormitoryId === null;

  // --- [1] GROUP_FINAL / PAIR_FINAL: 확정 뷰 (early return) ---
  const isGroupFinal = isGroupMatch && activeMatch?.groupStage === 'GROUP_FINAL';
  const isPairFinal = isGroupMatch && activeMatch?.groupStage === 'PAIR_FINAL';

  if (activeMatch && (isGroupFinal || isPairFinal)) {
    const groupMembers = activeMatch.groupMembers ?? [
      { userId: user.id, nickname: user.nickname },
      { userId: activeMatch.partnerUserId, nickname: activeMatch.partnerNickname },
    ];
    const memberNicknames = groupMembers.map((m) => m.nickname);
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
        <div className="px-5 py-5 max-w-md mx-auto">
          <div className="mb-4">
            <PolicyHintBanner hints={policyHints} />
          </div>
          <MatchingCompactCard
            nickname={memberNicknames.join(' & ')}
            dormitoryId={activeMatch.partnerDormitoryId}
            matchScore={activeMatch.matchScore}
            scoreType={activeMatch.scoreType}
            borderColor="border-green-300"
            avatarSlot={<OverlappedAvatars nicknames={memberNicknames} size="lg" />}
            pills={[
              {
                label: isGroupFinal ? '3인 매칭 확정' : '2인 매칭 확정',
                className: 'bg-green-600 text-white border border-green-600',
              },
            ]}
            status={{
              label: '매칭이 확정되었어요',
              color: 'text-green-700',
              dotColor: 'bg-green-500',
            }}
            actions={[
              {
                label: isGroupFinal ? '그룹 떠나기' : '매칭 취소하기',
                variant: activeMatch.cancelRequestedAt
                  ? ('disabled' as const)
                  : ('danger' as const),
                onClick: () =>
                  setConfirmAction({ type: 'endMatch', nickname: memberNicknames.join(' & ') }),
              },
            ]}
          />
          {renderDialogs()}
        </div>
      </div>
    );
  }

  // --- [1b] 2인실 ACTIVE (early return) ---
  if (activeMatch && !isGroupCoreOpen && !isGroupForming) {
    const partnerProfile = getPartnerProfile(
      matchRequests.find((r) => r.status === 'ACTIVE') ?? matchRequests[0]!,
    );
    const isPairFinal = activeMatch.kind === 'group' && activeMatch.groupStage === 'PAIR_FINAL';
    const pairFinalMembers = activeMatch.groupMembers ?? [
      { userId: user.id, nickname: user.nickname },
      { userId: activeMatch.partnerUserId, nickname: activeMatch.partnerNickname },
    ];
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
        <div className="px-5 py-5 max-w-md mx-auto">
          <div className="mb-4">
            <PolicyHintBanner hints={policyHints} />
          </div>
          {isPairFinal ? (
            <MatchingCompactCard
              nickname={pairFinalMembers.map((m) => m.nickname).join(' & ')}
              dormitoryId={activeMatch.partnerDormitoryId}
              matchScore={activeMatch.matchScore}
              scoreType={activeMatch.scoreType}
              borderColor="border-green-300"
              avatarSlot={
                <OverlappedAvatars nicknames={pairFinalMembers.map((m) => m.nickname)} size="lg" />
              }
              pills={[
                {
                  label: '2인 매칭 확정',
                  className: 'bg-green-600 text-white border border-green-600',
                },
              ]}
              status={{
                label: '매칭이 확정되었어요',
                color: 'text-green-700',
                dotColor: 'bg-green-500',
              }}
              actions={[
                {
                  label: '매칭 취소하기',
                  variant: activeMatch.cancelRequestedAt ? 'disabled' : 'danger',
                  onClick: () =>
                    setConfirmAction({ type: 'endMatch', nickname: activeMatch.partnerNickname }),
                },
              ]}
            />
          ) : (
            <ActiveMatchCard
              nickname={activeMatch.partnerNickname}
              dormitoryId={activeMatch.partnerDormitoryId}
              matchScore={activeMatch.matchScore}
              scoreType={activeMatch.scoreType}
              cancelPending={activeMatch.cancelRequestedAt !== null}
              cancelRequestedByCurrentUser={activeMatch.cancelRequestedBy === user.id}
              cancelRequestKind={activeMatch.cancelRequestKind}
              cancelApprovalCount={activeMatch.cancelApprovalUserIds?.length ?? 0}
              cancelApprovalTotal={1}
              onViewProfile={() =>
                setSelectedProfile({
                  profile: partnerProfile,
                  direction: 'conversation',
                  requestId: '',
                })
              }
              onRelease={() =>
                setConfirmAction({
                  type: 'endMatch',
                  nickname: activeMatch.partnerNickname,
                })
              }
            />
          )}
          {renderDialogs()}
        </div>
      </div>
    );
  }

  // --- [2][3][4] SEASON_MATCHING (메인 화면) ---
  const hasActivity =
    isGroupCoreOpen ||
    isGroupForming ||
    conversations.length > 0 ||
    sentPending.length > 0 ||
    receivedPending.length > 0 ||
    history.length > 0;

  return (
    <div className={`min-h-screen ${matchingStageBackground}`}>
      <MatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
      <div className="px-5 py-5 max-w-md mx-auto space-y-5">
        {/* 서브 네비게이션 */}
        <SubNav
          options={[
            { id: 'current', label: '현재 시즌' },
            { id: 'past', label: '과거 이력' },
          ]}
          selected={subNavTab}
          onChange={(id) => setSubNavTab(id as SubNavTab)}
        />

        {subNavTab === 'current' && <PolicyHintBanner hints={policyHints} />}

        <AnimatePresence mode="wait">
          {subNavTab === 'current' ? (
            <motion.div
              key="current"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              {isUnassigned && seasonState === 'SEASON_MATCHING' ? (
                <MatchingEmptyState type="no_building" icon={Building2} />
              ) : !hasActivity ? (
                <MatchingEmptyState
                  icon={Handshake}
                  title="아직 매칭 활동이 없어요"
                  description="룸메이트를 탐색하고 매칭 요청을 보내보세요!"
                  action={{ label: '룸메 찾기로 이동', onClick: () => onNavigate('list') }}
                />
              ) : (
                <>
                  {/* 3인실 TipCard: 건물이 3인실이면 항상 표시 */}
                  {user.dormitoryId && getMatchGroupSize(user.dormitoryId) === 3 && (
                    <GroupInfoTipCard />
                  )}

                  {/* [2] 대화 중 */}
                  {conversations.length > 0 && (
                    <section ref={convSectionRef}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 rounded-full bg-indigo-500" />
                        <h2 className="text-lg font-bold text-[var(--knu-text-primary)] flex items-center gap-2">
                          <MessageCircle className="w-4.5 h-4.5 text-indigo-500" />
                          {isGroupCoreOpen ? '합류 검토 중' : '대화 중'}
                          <span className="text-sm font-normal text-[var(--knu-text-tertiary)]">
                            ({conversations.length})
                          </span>
                        </h2>
                      </div>
                      <div className="space-y-3">
                        {displayedConversations.map((req) => {
                          const partner = getPartnerProfile(req);
                          const approvalCount = req.approvalUserIds?.length ?? 0;
                          const approvalTotal = isGroupForming
                            ? (activeMatch?.groupMemberCount ?? 3)
                            : 2;
                          const viewerConfirmed = req.approvalUserIds?.includes(user.id) === true;
                          const convExpiresMs = req.acceptedAt
                            ? new Date(req.acceptedAt).getTime() + 7 * 24 * 3600000 - renderedAt
                            : 0;
                          const convHoursLeft = Math.max(0, Math.floor(convExpiresMs / 3600000));
                          const convExpired = convHoursLeft <= 0;
                          const convTimeDisplay = convExpired
                            ? '만료됨'
                            : convHoursLeft < 24
                              ? `${convHoursLeft}시간`
                              : `D-${Math.ceil(convHoursLeft / 24)}`;
                          const convUrgent = !convExpired && convHoursLeft < 24;
                          return (
                            <MatchingCompactCard
                              key={req.id}
                              nickname={partner.nickname}
                              dormitoryId={partner.dormitoryId}
                              matchScore={partner.matchScore}
                              scoreType={partner.scoreType}
                              borderColor="border-indigo-300"
                              status={{
                                label: '대화 중',
                                color: 'text-emerald-600',
                                dotColor: 'bg-emerald-500',
                              }}
                              statusPills={[
                                {
                                  label: `확정 ${approvalCount}/${approvalTotal}`,
                                  className:
                                    approvalCount === 0
                                      ? 'bg-gray-100 text-gray-500'
                                      : approvalCount >= approvalTotal
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700',
                                },
                              ]}
                              timer={
                                req.acceptedAt
                                  ? {
                                      text: convExpired ? '만료됨' : `남은 시간 ${convTimeDisplay}`,
                                      urgent: convUrgent,
                                      expired: convExpired,
                                    }
                                  : undefined
                              }
                              actions={[
                                {
                                  label: '채팅',
                                  icon: <MessageCircle className="h-3.5 w-3.5" />,
                                  variant: 'disabled',
                                  onClick: () => {},
                                },
                                {
                                  label: viewerConfirmed ? '확정 취소' : '확정하기',
                                  icon: <Check className="h-3.5 w-3.5" />,
                                  variant: viewerConfirmed ? 'secondary' : 'primary',
                                  onClick: () =>
                                    setConfirmAction({
                                      type: viewerConfirmed ? 'revokeConfirm' : 'confirmMatch',
                                      requestId: req.id,
                                      nickname: partner.nickname,
                                    }),
                                },
                              ]}
                              menuItems={[
                                {
                                  label: '프로필 보기',
                                  icon: <User className="h-4 w-4" />,
                                  onClick: () =>
                                    setSelectedProfile({
                                      profile: partner,
                                      direction: 'conversation',
                                      requestId: req.id,
                                    }),
                                },
                                {
                                  label: '대화 종료',
                                  icon: <X className="h-4 w-4" />,
                                  variant: viewerConfirmed ? 'disabled' : 'danger',
                                  onClick: () =>
                                    setConfirmAction({
                                      type: 'endConversation',
                                      requestId: req.id,
                                      nickname: partner.nickname,
                                    }),
                                },
                              ]}
                            />
                          );
                        })}
                        <ShowMoreButton
                          remainingCount={conversations.length - convShowCount}
                          isExpanded={convShowCount >= conversations.length}
                          totalCount={conversations.length}
                          initialCount={INITIAL_SHOW}
                          onClick={() =>
                            handleToggleMore(
                              conversations.length,
                              convShowCount,
                              INITIAL_SHOW,
                              3,
                              setConvShowCount,
                              convSectionRef,
                            )
                          }
                        />
                      </div>
                    </section>
                  )}

                  {/* [3] 요청 관리 */}
                  <section ref={recvSectionRef}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 rounded-full bg-sky-400" />
                      <h2 className="text-lg font-bold text-[var(--knu-text-primary)] flex items-center gap-2">
                        <List className="w-4.5 h-4.5 text-sky-500" />
                        {isGroupCoreOpen ? '그룹 합류 요청' : '요청 관리'}
                      </h2>
                    </div>

                    <div className="mb-4">
                      {isGroupCoreOpen ? (
                        <SegmentControl
                          options={[
                            {
                              id: 'received',
                              label: '받은 합류 요청',
                              badge: receivedPending.length,
                            },
                          ]}
                          selected="received"
                          onChange={() => setRequestTab('received')}
                        />
                      ) : (
                        <SegmentControl
                          options={[
                            {
                              id: 'sent',
                              label: `보낸 요청 (${sentPending.length}/${MATCH_POLICY.MAX_PENDING_REQUESTS})`,
                            },
                            { id: 'received', label: '받은 요청', badge: receivedPending.length },
                          ]}
                          selected={requestTab}
                          onChange={(id) => setRequestTab(id as RequestTab)}
                        />
                      )}
                    </div>

                    {(isGroupCoreOpen || requestTab === 'received') &&
                      receivedPending.length > 0 && (
                        <div className="-mt-1 mb-4 flex justify-end">
                          <SortToggle value={receivedSort} onChange={setReceivedSort} />
                        </div>
                      )}

                    <AnimatePresence mode="wait">
                      {!isGroupCoreOpen && requestTab === 'sent' && (
                        <motion.div
                          key="sent"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="space-y-3"
                        >
                          {sentPending.length > 0 ? (
                            sentPending.map((req) => {
                              const partner = getPartnerProfile(req);
                              // 3인실 GROUP_CONV_JOIN → CompactCard
                              if (req.requestKind === 'GROUP_CONV_JOIN') {
                                const groupNicknames =
                                  req.groupTargetUserIds?.map(
                                    (targetId) => profileMap.get(targetId)?.nickname ?? targetId,
                                  ) ?? [];
                                const gjHoursLeft = Math.max(
                                  0,
                                  Math.floor(
                                    (new Date(req.expiresAt).getTime() - renderedAt) / 3600000,
                                  ),
                                );
                                const gjExpired = gjHoursLeft <= 0;
                                const gjTimeDisplay = gjExpired
                                  ? '만료됨'
                                  : gjHoursLeft < 24
                                    ? `${gjHoursLeft}시간`
                                    : `D-${Math.ceil(gjHoursLeft / 24)}`;
                                return (
                                  <MatchingCompactCard
                                    key={req.id}
                                    nickname={groupNicknames.join(' & ')}
                                    dormitoryId={partner.dormitoryId}
                                    matchScore={partner.matchScore}
                                    scoreType={partner.scoreType}
                                    hideScore
                                    avatarSlot={
                                      groupNicknames.length > 1 ? (
                                        <OverlappedAvatars nicknames={groupNicknames} />
                                      ) : undefined
                                    }
                                    pills={[
                                      {
                                        label: '그룹 합류',
                                        className:
                                          'bg-blue-100 text-blue-700 border border-blue-200',
                                      },
                                    ]}
                                    status={{
                                      label: '수락 대기 중',
                                      color: 'text-amber-600',
                                      dotColor: 'bg-amber-400',
                                    }}
                                    message={req.message}
                                    timer={{
                                      text: gjTimeDisplay,
                                      urgent: !gjExpired && gjHoursLeft < 24,
                                      expired: gjExpired,
                                    }}
                                    actions={[
                                      {
                                        label: '요청 취소',
                                        variant: gjExpired ? 'disabled' : 'danger',
                                        onClick: () =>
                                          setConfirmAction({
                                            type: 'cancel',
                                            requestId: req.id,
                                            nickname: groupNicknames.join(' & '),
                                          }),
                                      },
                                    ]}
                                    onClick={() =>
                                      setSelectedProfile({
                                        profile: partner,
                                        direction: 'sent',
                                        requestId: req.id,
                                      })
                                    }
                                  />
                                );
                              }
                              const hoursLeft = Math.max(
                                0,
                                Math.floor(
                                  (new Date(req.expiresAt).getTime() - renderedAt) / 3600000,
                                ),
                              );
                              const isExpired = hoursLeft <= 0;
                              const timeDisplay = isExpired
                                ? '만료됨'
                                : hoursLeft < 24
                                  ? `${hoursLeft}시간`
                                  : `D-${Math.ceil(hoursLeft / 24)}`;
                              const isUrgent = !isExpired && hoursLeft < 24;
                              return (
                                <MatchingCompactCard
                                  key={req.id}
                                  nickname={partner.nickname}
                                  dormitoryId={partner.dormitoryId}
                                  matchScore={partner.matchScore}
                                  scoreType={partner.scoreType}
                                  borderColor="border-indigo-100"
                                  status={{
                                    label: '수락 대기 중',
                                    color: 'text-amber-600',
                                    dotColor: 'bg-amber-400',
                                  }}
                                  message={req.message}
                                  timer={{
                                    text: isExpired ? '만료됨' : `남은 시간 ${timeDisplay}`,
                                    urgent: isUrgent,
                                    expired: isExpired,
                                  }}
                                  actions={[
                                    {
                                      label: '프로필',
                                      icon: <User className="h-3.5 w-3.5" />,
                                      variant: 'secondary',
                                      onClick: () =>
                                        setSelectedProfile({
                                          profile: partner,
                                          direction: 'sent',
                                          requestId: req.id,
                                        }),
                                    },
                                    {
                                      label: '취소',
                                      icon: <X className="h-3.5 w-3.5" />,
                                      variant: isExpired ? 'disabled' : 'secondary',
                                      onClick: () =>
                                        setConfirmAction({
                                          type: 'cancel',
                                          requestId: req.id,
                                          nickname: partner.nickname,
                                        }),
                                    },
                                  ]}
                                  menuItems={[
                                    {
                                      label: '차단하기',
                                      icon: <Ban className="h-4 w-4" />,
                                      variant: 'danger',
                                      onClick: () => {},
                                    },
                                    {
                                      label: '신고하기',
                                      icon: <Flag className="h-4 w-4" />,
                                      variant: 'danger',
                                      onClick: () => {},
                                    },
                                  ]}
                                />
                              );
                            })
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-sm text-[var(--knu-text-tertiary)] mb-1">
                                대기 중인 요청이 없어요
                              </p>
                              <p className="text-xs text-[var(--knu-text-tertiary)] mb-4">
                                프로필을 둘러보고 마음에 드는 상대에게 요청을 보내보세요
                              </p>
                              <motion.button
                                onClick={() => onNavigate('list')}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className="px-5 py-2.5 bg-gradient-to-r from-[var(--knu-primary)] to-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-200/50 transition-all flex items-center justify-center gap-1.5 mx-auto"
                              >
                                매칭 상대 둘러보기
                                <ChevronRight className="w-4 h-4" />
                              </motion.button>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {(isGroupCoreOpen || requestTab === 'received') && (
                        <motion.div
                          key="received"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-3"
                        >
                          {receivedPending.length > 0 ? (
                            <>
                              {displayedReceived.map((req) => {
                                const partner = getPartnerProfile(req);
                                // 3인실 GROUP_CONV_JOIN → CompactCard
                                if (req.requestKind === 'GROUP_CONV_JOIN') {
                                  const gjrHoursLeft = Math.max(
                                    0,
                                    Math.floor(
                                      (new Date(req.expiresAt).getTime() - renderedAt) / 3600000,
                                    ),
                                  );
                                  const gjrExpired = gjrHoursLeft <= 0;
                                  const gjrTimeDisplay = gjrExpired
                                    ? '만료됨'
                                    : gjrHoursLeft < 24
                                      ? `${gjrHoursLeft}시간`
                                      : `D-${Math.ceil(gjrHoursLeft / 24)}`;
                                  const viewerApproved =
                                    req.approvalUserIds?.includes(user.id) === true;
                                  return (
                                    <MatchingCompactCard
                                      key={req.id}
                                      nickname={partner.nickname}
                                      dormitoryId={partner.dormitoryId}
                                      matchScore={partner.matchScore}
                                      scoreType={partner.scoreType}
                                      pills={[
                                        {
                                          label: '그룹 합류 요청',
                                          className:
                                            'bg-purple-100 text-purple-700 border border-purple-200',
                                        },
                                      ]}
                                      status={{
                                        label: '응답 필요',
                                        color: 'text-purple-600',
                                        dotColor: 'bg-purple-500',
                                      }}
                                      statusPills={[
                                        {
                                          label: `${req.approvalUserIds?.length ?? 0}/2 승인`,
                                          className:
                                            'bg-amber-100 text-amber-700 border border-amber-200',
                                        },
                                      ]}
                                      message={req.message}
                                      timer={{
                                        text: gjrTimeDisplay,
                                        urgent: !gjrExpired && gjrHoursLeft < 24,
                                        expired: gjrExpired,
                                      }}
                                      actions={[
                                        {
                                          label: '거절',
                                          variant: gjrExpired
                                            ? ('disabled' as const)
                                            : ('secondary' as const),
                                          onClick: () =>
                                            setConfirmAction({
                                              type: 'reject',
                                              requestId: req.id,
                                              nickname: partner.nickname,
                                            }),
                                        },
                                        viewerApproved
                                          ? {
                                              label: '승인 취소',
                                              variant: 'warning' as const,
                                              onClick: () =>
                                                setConfirmAction({
                                                  type: 'accept',
                                                  requestId: req.id,
                                                  nickname: partner.nickname,
                                                }),
                                            }
                                          : {
                                              label: '합류 승인',
                                              variant: gjrExpired
                                                ? ('disabled' as const)
                                                : ('primary' as const),
                                              onClick: () =>
                                                setConfirmAction({
                                                  type: 'accept',
                                                  requestId: req.id,
                                                  nickname: partner.nickname,
                                                }),
                                            },
                                      ]}
                                      onClick={() =>
                                        setSelectedProfile({
                                          profile: partner,
                                          direction: 'received',
                                          requestId: req.id,
                                        })
                                      }
                                    />
                                  );
                                }
                                const recvHoursLeft = Math.max(
                                  0,
                                  Math.floor(
                                    (new Date(req.expiresAt).getTime() - renderedAt) / 3600000,
                                  ),
                                );
                                const recvExpired = recvHoursLeft <= 0;
                                const recvTimeDisplay = recvExpired
                                  ? '만료됨'
                                  : recvHoursLeft < 24
                                    ? `${recvHoursLeft}시간`
                                    : `D-${Math.ceil(recvHoursLeft / 24)}`;
                                const isRecommended = partner.matchScore >= 85;
                                const isNew = !req.approvalUserIds?.includes(user.id);
                                return (
                                  <MatchingCompactCard
                                    key={req.id}
                                    nickname={partner.nickname}
                                    dormitoryId={partner.dormitoryId}
                                    matchScore={partner.matchScore}
                                    scoreType={partner.scoreType}
                                    borderColor={
                                      isRecommended ? 'border-pink-300' : 'border-purple-200'
                                    }
                                    pills={[
                                      ...(isRecommended
                                        ? [
                                            {
                                              label: '추천 매칭',
                                              icon: <Sparkles className="h-3 w-3" />,
                                              className:
                                                'bg-gradient-to-r from-pink-500 to-rose-400 text-white',
                                            },
                                          ]
                                        : []),
                                      ...(isNew
                                        ? [{ label: 'New', className: 'bg-red-500 text-white' }]
                                        : []),
                                    ]}
                                    status={{
                                      label: '응답 필요',
                                      color: 'text-purple-600',
                                      dotColor: 'bg-purple-400',
                                    }}
                                    message={req.message}
                                    timer={{
                                      text: recvExpired ? '만료됨' : `남은 시간 ${recvTimeDisplay}`,
                                      urgent: !recvExpired && recvHoursLeft < 24,
                                      expired: recvExpired,
                                    }}
                                    actions={[
                                      {
                                        label: '거절',
                                        icon: <X className="h-3.5 w-3.5" />,
                                        variant: recvExpired ? 'disabled' : 'secondary',
                                        onClick: () =>
                                          setConfirmAction({
                                            type: 'reject',
                                            requestId: req.id,
                                            nickname: partner.nickname,
                                          }),
                                      },
                                      {
                                        label: '수락하기',
                                        icon: <Check className="h-3.5 w-3.5" />,
                                        variant: recvExpired ? 'disabled' : 'primary',
                                        onClick: () =>
                                          setConfirmAction({
                                            type: 'accept',
                                            requestId: req.id,
                                            nickname: partner.nickname,
                                          }),
                                      },
                                    ]}
                                    menuItems={[
                                      {
                                        label: '프로필 보기',
                                        icon: <User className="h-4 w-4" />,
                                        onClick: () =>
                                          setSelectedProfile({
                                            profile: partner,
                                            direction: 'received',
                                            requestId: req.id,
                                          }),
                                      },
                                      {
                                        label: '차단하기',
                                        icon: <Ban className="h-4 w-4" />,
                                        variant: 'danger',
                                        onClick: () => {},
                                      },
                                      {
                                        label: '신고하기',
                                        icon: <Flag className="h-4 w-4" />,
                                        variant: 'danger',
                                        onClick: () => {},
                                      },
                                    ]}
                                  />
                                );
                              })}
                              <ShowMoreButton
                                remainingCount={sortedReceived.length - recvShowCount}
                                isExpanded={recvShowCount >= sortedReceived.length}
                                totalCount={sortedReceived.length}
                                initialCount={INITIAL_SHOW}
                                onClick={() =>
                                  handleToggleMore(
                                    sortedReceived.length,
                                    recvShowCount,
                                    INITIAL_SHOW,
                                    3,
                                    setRecvShowCount,
                                    recvSectionRef,
                                  )
                                }
                              />
                            </>
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-sm text-[var(--knu-text-tertiary)] mb-2">
                                {isGroupCoreOpen ? '아직 합류 요청이 없어요' : '받은 요청이 없어요'}
                              </p>
                              <p className="text-xs text-[var(--knu-text-tertiary)]">
                                {isGroupCoreOpen
                                  ? '개인이 그룹에 합류 요청을 보내면 여기에 표시돼요'
                                  : '다른 룸메가 요청을 보내면 여기에 표시돼요'}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* [4] 이력 */}
                  {aggregatedHistory.length > 0 && (
                    <section ref={histSectionRef}>
                      <button
                        onClick={() => setHistoryOpen(!historyOpen)}
                        className="w-full flex items-center justify-between mb-4 group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 rounded-full bg-gray-300" />
                          <h2 className="text-lg font-bold text-[var(--knu-text-primary)] flex items-center gap-2">
                            <Archive className="w-4.5 h-4.5 text-gray-400" />
                            이력 ({aggregatedHistory.length})
                          </h2>
                        </div>
                        {historyOpen ? (
                          <ChevronUp className="w-5 h-5 text-[var(--knu-text-tertiary)] group-hover:text-[var(--knu-text-primary)] transition-colors" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[var(--knu-text-tertiary)] group-hover:text-[var(--knu-text-primary)] transition-colors" />
                        )}
                      </button>

                      <AnimatePresence>
                        {historyOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            {displayedHistory.map((row) => {
                              const historyMeta =
                                row.aggregateCount &&
                                row.aggregateCount >= 2 &&
                                row.aggregateContext
                                  ? getRepeatedCancelledVisualMeta(
                                      row.aggregateContext,
                                      row.aggregateCount,
                                    )
                                  : getCurrentHistoryVisualMeta(row.request, user.id);
                              return (
                                <MatchingCompactCard
                                  key={row.request.id}
                                  nickname={row.partnerNickname}
                                  dormitoryId={row.partnerDormId}
                                  matchScore={0}
                                  scoreType="gated"
                                  hideScore
                                  hoverEffect={false}
                                  statusPulse={false}
                                  borderColor={matchingHistoryCardBorder}
                                  opacity={0.75}
                                  status={historyMeta.status}
                                  statusPills={
                                    historyMeta.stagePill ? [historyMeta.stagePill] : undefined
                                  }
                                />
                              );
                            })}
                            <ShowMoreButton
                              remainingCount={aggregatedHistory.length - histShowCount}
                              isExpanded={histShowCount >= aggregatedHistory.length}
                              totalCount={aggregatedHistory.length}
                              initialCount={HISTORY_INITIAL_SHOW}
                              onClick={() =>
                                handleToggleMore(
                                  aggregatedHistory.length,
                                  histShowCount,
                                  HISTORY_INITIAL_SHOW,
                                  3,
                                  setHistShowCount,
                                  histSectionRef,
                                )
                              }
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            renderPastView()
          )}
        </AnimatePresence>

        {renderDialogs()}
      </div>
    </div>
  );
}
