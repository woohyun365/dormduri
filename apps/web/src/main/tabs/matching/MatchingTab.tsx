'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Handshake, ChevronDown, ChevronUp, Building2, Calendar } from 'lucide-react';
import { UNASSIGNED_ID, isCampusOperated } from '@/constants/dormitory';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MATCH_POLICY } from '@/constants/match';
import { MatchRequestCard } from '../../components/MatchRequestCard';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import { MatchingTabHeader } from './MatchingTabHeader';
import { SubNav } from '../../components/matching/SubNav';
import { ConversationCard } from '../../components/matching/ConversationCard';
import { ActiveMatchCard } from '../../components/matching/ActiveMatchCard';
import { GroupCoreCard } from '../../components/matching/GroupCoreCard';
import { GroupCandidateCard } from '../../components/matching/GroupCandidateCard';
import { HistoryCard } from '../../components/matching/HistoryCard';
import { MatchingEmptyState } from '../../components/matching/MatchingEmptyState';
import { PastSeasonAccordion } from '../../components/matching/PastSeasonAccordion';
import { PolicyHintBanner } from '../../components/matching/PolicyHintBanner';
import { ShowMoreButton } from '../../components/matching/ShowMoreButton';
import { SegmentControl } from '../../components/matching/SegmentControl';
import { SortToggle } from '../../components/matching/SortToggle';
import { getMatchingPolicyHint } from '../../components/matching/policyCopy';
import type { SortOption } from '../../components/matching/SortToggle';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { doesRequestTargetUser, isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import { matchingStageBackground } from '@/main/styles/matching';
import type { MatchScoreType } from '@/utils/matchScore';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch, MatchStatus, PastSeasonData } from '@/types/match';

type RequestTab = 'sent' | 'received';
type SubNavTab = 'current' | 'past';

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
  onFinalizePairGroup,
  onEndConversation,
  onEndMatch,
  onNavigate,
  initialSection,
  initialRequestTab,
}: MatchingTabProps) {
  // --- Hooks ---
  const { state: seasonState } = useSeasonContext();
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

  // 더보기 / 정렬
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [showAllReceived, setShowAllReceived] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [receivedSort, setReceivedSort] = useState<SortOption>('matchScore');
  const isGroupCoreOpen = activeMatch?.kind === 'group' && activeMatch.groupStage === 'PAIR_OPEN';
  const isGroupForming =
    activeMatch?.kind === 'group' && activeMatch.groupStage === 'GROUP_FORMING';
  const isGroupMatch = activeMatch?.kind === 'group';
  const policyHint = getMatchingPolicyHint({
    activeMatch,
    requestTab,
    sentPendingCount: sentPending.length,
    receivedPendingCount: receivedPending.length,
    conversationsCount: conversations.length,
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
    { title: string; message: string; label: string; variant: 'default' | 'danger' }
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
      title: '매칭 확정',
      message: isGroupForming
        ? `${confirmAction?.nickname ?? ''}님과의 3인 그룹 확정을 승인하시겠습니까?\n3명이 모두 눌러야 최종 적용됩니다.`
        : `${confirmAction?.nickname ?? ''}님과의 매칭 확정을 승인하시겠습니까?\n양쪽이 모두 눌러야 최종 적용됩니다.`,
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
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [receivedPending, receivedSort, user.id, user.lifestyle, profileMap]);

  // 더보기 슬라이싱
  const displayedConversations = showAllConversations
    ? conversations
    : conversations.slice(0, INITIAL_SHOW);
  const displayedReceived = showAllReceived
    ? sortedReceived
    : sortedReceived.slice(0, INITIAL_SHOW);
  const displayedHistory = showAllHistory ? history : history.slice(0, HISTORY_INITIAL_SHOW);

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
        <MatchingTabHeader user={user} />
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
        <MatchingTabHeader user={user} />
        <div className="px-5 py-5 max-w-md mx-auto space-y-5">
          <SubNav
            options={[
              { id: 'current', label: '현재 시즌' },
              { id: 'past', label: '과거 이력' },
            ]}
            selected={subNavTab}
            onChange={(id) => setSubNavTab(id as SubNavTab)}
          />
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
        <MatchingTabHeader user={user} />
        <div className="px-5 py-5 max-w-md mx-auto space-y-5">
          <SubNav
            options={[
              { id: 'current', label: '현재 시즌' },
              { id: 'past', label: '과거 이력' },
            ]}
            selected={subNavTab}
            onChange={(id) => setSubNavTab(id as SubNavTab)}
          />
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

  // --- 게이팅: UNASSIGNED ---
  const isUnassigned = user.dormitoryId === UNASSIGNED_ID || user.dormitoryId === null;
  if (isUnassigned && seasonState === 'SEASON_MATCHING') {
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} />
        <div className="px-5 py-6 max-w-md mx-auto">
          <MatchingEmptyState type="no_building" icon={Building2} />
        </div>
      </div>
    );
  }

  // --- [1] Active Match ---
  if (activeMatch && isGroupMatch && (isGroupForming || activeMatch.groupStage === 'GROUP_FINAL')) {
    const formingConversation = matchRequests.find(
      (request) => request.status === 'IN_CONVERSATION',
    );
    const conversationPartner = formingConversation ? getPartnerProfile(formingConversation) : null;
    const groupDisplayMembers =
      activeMatch.groupMembers && conversationPartner && activeMatch.groupMembers.length >= 3
        ? [
            activeMatch.groupMembers[0]!,
            activeMatch.groupMembers[1]!,
            { userId: conversationPartner.id, nickname: conversationPartner.nickname },
          ]
        : (activeMatch.groupMembers ?? []);

    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} />
        <div className="px-5 py-5 max-w-md mx-auto">
          <div className="mb-4">
            <PolicyHintBanner hint={policyHint} />
          </div>
          {activeMatch.groupRole === 'group_candidate' ? (
            <GroupCandidateCard
              stage={activeMatch.groupStage ?? undefined}
              members={groupDisplayMembers}
              viewerConfirmed={formingConversation?.approvalUserIds?.includes(user.id) === true}
              cancelPending={activeMatch.cancelRequestedAt !== null}
              cancelRequestedByCurrentUser={activeMatch.cancelRequestedBy === user.id}
              cancelRequestKind={activeMatch.cancelRequestKind}
              onConfirmGroup={() => {
                if (!formingConversation) return;
                setConfirmAction({
                  type: 'confirmMatch',
                  requestId: formingConversation.id,
                  nickname: '현재 그룹',
                });
              }}
              onRevokeConfirmGroup={() => {
                if (!formingConversation) return;
                setConfirmAction({
                  type: 'revokeConfirm',
                  requestId: formingConversation.id,
                  nickname: '현재 그룹',
                });
              }}
              onLeaveGroup={() =>
                setConfirmAction({
                  type: 'endMatch',
                  nickname: '현재 그룹',
                })
              }
            />
          ) : (
            <GroupCoreCard
              stage={activeMatch.groupStage ?? undefined}
              role={activeMatch.groupRole}
              members={groupDisplayMembers}
              joinRequestCount={0}
              finalApprovalCount={formingConversation?.approvalUserIds?.length ?? 0}
              finalApprovalTotal={activeMatch.groupMemberCount ?? 3}
              viewerConfirmed={formingConversation?.approvalUserIds?.includes(user.id) === true}
              cancelPending={activeMatch.cancelRequestedAt !== null}
              cancelRequestedByCurrentUser={activeMatch.cancelRequestedBy === user.id}
              cancelRequestKind={activeMatch.cancelRequestKind}
              cancelApprovalCount={activeMatch.cancelApprovalUserIds?.length ?? 0}
              cancelApprovalTotal={
                activeMatch.cancelRequestKind === 'CANDIDATE_LEAVE'
                  ? 2
                  : (activeMatch.groupMemberCount ?? 3) - 1
              }
              onReviewRequests={() => setRequestTab('received')}
              onFinalizePair={onFinalizePairGroup}
              onConfirmGroup={() => {
                if (!formingConversation) return;
                setConfirmAction({
                  type: 'confirmMatch',
                  requestId: formingConversation.id,
                  nickname: conversationPartner?.nickname ?? activeMatch.partnerNickname,
                });
              }}
              onRevokeConfirmGroup={() => {
                if (!formingConversation) return;
                setConfirmAction({
                  type: 'revokeConfirm',
                  requestId: formingConversation.id,
                  nickname: conversationPartner?.nickname ?? activeMatch.partnerNickname,
                });
              }}
              onDissolve={() =>
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

  if (activeMatch && !isGroupCoreOpen) {
    const partnerProfile = getPartnerProfile(
      matchRequests.find((r) => r.status === 'ACTIVE') ?? matchRequests[0]!,
    );
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <MatchingTabHeader user={user} />
        <div className="px-5 py-5 max-w-md mx-auto">
          <div className="mb-4">
            <PolicyHintBanner hint={policyHint} />
          </div>
          <ActiveMatchCard
            nickname={activeMatch.partnerNickname}
            dormitoryId={activeMatch.partnerDormitoryId}
            matchScore={activeMatch.matchScore}
            scoreType={activeMatch.scoreType}
            cancelPending={activeMatch.cancelRequestedAt !== null}
            cancelRequestedByCurrentUser={activeMatch.cancelRequestedBy === user.id}
            cancelRequestKind={activeMatch.cancelRequestKind}
            cancelApprovalCount={activeMatch.cancelApprovalUserIds?.length ?? 0}
            cancelApprovalTotal={
              activeMatch.kind === 'group' && activeMatch.groupStage === 'GROUP_FINAL' ? 2 : 1
            }
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
      <MatchingTabHeader user={user} />
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

        {subNavTab === 'current' && <PolicyHintBanner hint={policyHint} />}

        <AnimatePresence mode="wait">
          {subNavTab === 'current' ? (
            <motion.div
              key="current"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              {!hasActivity ? (
                <MatchingEmptyState
                  icon={Handshake}
                  title="아직 매칭 활동이 없어요"
                  description="룸메이트를 탐색하고 매칭 요청�� 보내보세요!"
                  action={{ label: '룸메 찾기로 이동', onClick: () => onNavigate('list') }}
                  suggestions={[
                    { icon: '🎯', text: '프로필을 80% 이상 작성하면 노출률이 높아져요' },
                    { icon: '⚡', text: '매칭도가 높은 사용자에게 먼저 연락해보세요' },
                  ]}
                />
              ) : (
                <>
                  {isGroupCoreOpen && (
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 rounded-full bg-blue-500" />
                        <h2 className="text-lg font-bold text-[var(--knu-text-primary)]">
                          3인실 그룹
                        </h2>
                      </div>
                      <GroupCoreCard
                        members={
                          activeMatch.groupMembers ?? [
                            { userId: user.id, nickname: user.nickname },
                            {
                              userId: activeMatch.partnerUserId,
                              nickname: activeMatch.partnerNickname,
                            },
                          ]
                        }
                        joinRequestCount={receivedPending.length}
                        onReviewRequests={() => setRequestTab('received')}
                        onFinalizePair={onFinalizePairGroup}
                        onDissolve={() =>
                          setConfirmAction({
                            type: 'endMatch',
                            nickname: activeMatch.partnerNickname,
                          })
                        }
                      />
                    </section>
                  )}

                  {/* [2] 대화 중 */}
                  {conversations.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 rounded-full bg-blue-500" />
                        <h2 className="text-lg font-bold text-[var(--knu-text-primary)] flex items-center gap-2">
                          {isGroupCoreOpen ? '합류 검토 중' : '대화 중'}
                          <span className="text-sm font-normal text-[var(--knu-text-tertiary)]">
                            ({conversations.length})
                          </span>
                        </h2>
                      </div>
                      <div className="space-y-3">
                        {displayedConversations.map((req) => {
                          const partner = getPartnerProfile(req);
                          return (
                            <ConversationCard
                              key={req.id}
                              nickname={partner.nickname}
                              dormitoryId={partner.dormitoryId}
                              matchScore={partner.matchScore}
                              scoreType={partner.scoreType}
                              confirmApprovalCount={req.approvalUserIds?.length ?? 0}
                              confirmApprovalTotal={
                                isGroupForming ? (activeMatch?.groupMemberCount ?? 3) : 2
                              }
                              viewerConfirmed={req.approvalUserIds?.includes(user.id) === true}
                              partnerConfirmed={
                                req.approvalUserIds?.some((approvalId) => approvalId !== user.id) ??
                                false
                              }
                              onViewProfile={() =>
                                setSelectedProfile({
                                  profile: partner,
                                  direction: 'conversation',
                                  requestId: req.id,
                                })
                              }
                              onConfirm={() =>
                                setConfirmAction({
                                  type: 'confirmMatch',
                                  requestId: req.id,
                                  nickname: partner.nickname,
                                })
                              }
                              onRevokeConfirm={() =>
                                setConfirmAction({
                                  type: 'revokeConfirm',
                                  requestId: req.id,
                                  nickname: partner.nickname,
                                })
                              }
                              onEnd={() =>
                                setConfirmAction({
                                  type: 'endConversation',
                                  requestId: req.id,
                                  nickname: partner.nickname,
                                })
                              }
                            />
                          );
                        })}
                        <ShowMoreButton
                          remainingCount={conversations.length - INITIAL_SHOW}
                          isExpanded={showAllConversations}
                          onClick={() => setShowAllConversations(!showAllConversations)}
                        />
                      </div>
                    </section>
                  )}

                  {/* [3] 요청 관리 */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 rounded-full bg-[var(--knu-primary)]" />
                      <h2 className="text-lg font-bold text-[var(--knu-text-primary)]">
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
                              return (
                                <MatchRequestCard
                                  key={req.id}
                                  request={req}
                                  direction="sent"
                                  partnerProfile={partner}
                                  scoreType={partner.scoreType}
                                  viewerId={user.id}
                                  groupTargetNicknames={
                                    req.requestKind === 'GROUP_JOIN'
                                      ? req.groupTargetUserIds?.map(
                                          (targetId) =>
                                            profileMap.get(targetId)?.nickname ?? targetId,
                                        )
                                      : undefined
                                  }
                                  onCancel={(id) =>
                                    setConfirmAction({
                                      type: 'cancel',
                                      requestId: id,
                                      nickname: partner.nickname,
                                    })
                                  }
                                  onClick={() =>
                                    setSelectedProfile({
                                      profile: partner,
                                      direction: 'sent',
                                      requestId: req.id,
                                    })
                                  }
                                />
                              );
                            })
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-sm text-[var(--knu-text-tertiary)] mb-3">
                                보낸 요청이 없어요
                              </p>
                              <p className="text-xs text-[var(--knu-text-tertiary)] mb-4">
                                룸메 찾기에서 마음에 드는 룸메에게 요청을 보내보세요
                              </p>
                              <button
                                onClick={() => onNavigate('list')}
                                className="px-4 py-2 text-sm font-semibold text-[var(--knu-primary)] bg-[var(--knu-primary-light)] rounded-xl"
                              >
                                룸메 찾��로 이동
                              </button>
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
                              <SortToggle value={receivedSort} onChange={setReceivedSort} />
                              {displayedReceived.map((req) => {
                                const partner = getPartnerProfile(req);
                                return (
                                  <MatchRequestCard
                                    key={req.id}
                                    request={req}
                                    direction="received"
                                    partnerProfile={partner}
                                    scoreType={partner.scoreType}
                                    viewerId={user.id}
                                    onAccept={(id) =>
                                      setConfirmAction({
                                        type: 'accept',
                                        requestId: id,
                                        nickname: partner.nickname,
                                      })
                                    }
                                    onReject={(id) =>
                                      setConfirmAction({
                                        type: 'reject',
                                        requestId: id,
                                        nickname: partner.nickname,
                                      })
                                    }
                                    onClick={() =>
                                      setSelectedProfile({
                                        profile: partner,
                                        direction: 'received',
                                        requestId: req.id,
                                      })
                                    }
                                  />
                                );
                              })}
                              <ShowMoreButton
                                remainingCount={sortedReceived.length - INITIAL_SHOW}
                                isExpanded={showAllReceived}
                                onClick={() => setShowAllReceived(!showAllReceived)}
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
                  {history.length > 0 && (
                    <section>
                      <button
                        onClick={() => setHistoryOpen(!historyOpen)}
                        className="w-full flex items-center justify-between mb-4 group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 rounded-full bg-gray-300" />
                          <h2 className="text-lg font-bold text-[var(--knu-text-primary)]">
                            이력 ({history.length})
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
                            {displayedHistory.map((req) => {
                              const partnerId = getPartnerId(req, user.id);
                              const partnerNickname =
                                profileMap.get(partnerId)?.nickname ?? partnerId;
                              return (
                                <HistoryCard
                                  key={req.id}
                                  nickname={partnerNickname}
                                  status={req.status}
                                  date={req.resolvedAt ?? req.createdAt}
                                />
                              );
                            })}
                            <ShowMoreButton
                              remainingCount={history.length - HISTORY_INITIAL_SHOW}
                              isExpanded={showAllHistory}
                              onClick={() => setShowAllHistory(!showAllHistory)}
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
