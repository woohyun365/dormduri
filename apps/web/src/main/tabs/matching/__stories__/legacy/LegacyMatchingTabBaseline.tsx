'use client';

import { useMemo, useState } from 'react';
import { Check, MessageCircle, User, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MATCH_POLICY } from '@/constants/match';
import { ActiveMatchCard } from '@/main/components/matching/ActiveMatchCard';
import { LegacyMatchingTabHeader } from './LegacyMatchingTabHeader';
import { MatchingCompactCard } from '../../../../components/matching/MatchingCompactCard';
import { MatchingEmptyState } from '../../../../components/matching/MatchingEmptyState';
import { PolicyHintBanner } from '../../../../components/matching/PolicyHintBanner';
import { SegmentControl } from '../../../../components/matching/SegmentControl';
import { SortToggle, type SortOption } from '../../../../components/matching/SortToggle';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScoreWithGating, type MatchScoreType } from '@/utils/matchScore';
import { matchingStageBackground } from '@/main/styles/matching';
import { getMatchingPolicyHints } from '../../../../components/matching/policyCopy';
import type { ActiveMatch, MatchRequest, PastSeasonData } from '@/types/match';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';

type RequestTab = 'sent' | 'received';

interface LegacyMatchingTabBaselineProps {
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
  onEndConversation: (requestId: string) => void;
  onEndMatch: () => void;
  onNavigate: (tab: TabId) => void;
  initialSection?: 'current' | 'past';
  initialRequestTab?: RequestTab;
}

function getPartnerId(request: MatchRequest, viewerId: string) {
  return request.fromUserId === viewerId ? request.toUserId : request.fromUserId;
}

function getRequestHoursLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
}

export function LegacyMatchingTabBaseline({
  user,
  matchRequests,
  activeMatch,
  profiles,
  pastSeasons: _pastSeasons,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onConfirmMatch,
  onRevokeConfirmMatch,
  onEndConversation,
  onEndMatch,
  onNavigate,
  initialSection: _initialSection,
  initialRequestTab = 'sent',
}: LegacyMatchingTabBaselineProps) {
  const { state: seasonState, daysUntilEnd } = useSeasonContext();
  const [requestTab, setRequestTab] = useState<RequestTab>(initialRequestTab);
  const [receivedSort, setReceivedSort] = useState<SortOption>('oldest');
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'default' | 'danger';
  } | null>(null);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const sentPending = matchRequests.filter(
    (request) =>
      request.fromUserId === user.id && request.status === 'PENDING' && !isRequestExpired(request),
  );
  const receivedPending = matchRequests.filter(
    (request) =>
      request.toUserId === user.id && request.status === 'PENDING' && !isRequestExpired(request),
  );
  const conversations = matchRequests.filter((request) => request.status === 'IN_CONVERSATION');
  const policyHints = getMatchingPolicyHints({
    seasonState,
    activeMatch,
    sentPendingCount: sentPending.length,
    receivedPendingCount: receivedPending.length,
    conversationsCount: conversations.length,
    daysUntilEnd,
  });

  const toPartner = (request: MatchRequest): RoommateProfile & { scoreType: MatchScoreType } => {
    const partnerId = getPartnerId(request, user.id);
    const profile = profileMap.get(partnerId);
    const score = profile
      ? calcMatchScoreWithGating(user.lifestyle, profile.lifestyle)
      : { score: null, type: 'gated' as const };
    return {
      id: profile?.id ?? partnerId,
      nickname: profile?.nickname ?? partnerId,
      gender: profile?.gender ?? 'M',
      campus: profile?.campus ?? 'CHUNCHEON',
      dormitoryId: profile?.dormitoryId ?? null,
      lifestyle: profile?.lifestyle ?? ({} as RoommateProfile['lifestyle']),
      intro: profile?.intro ?? '',
      messageToRoommate: profile?.messageToRoommate ?? null,
      additional: profile?.additional ?? {
        college: null,
        grade: null,
        mbti: null,
        birthYear: null,
      },
      matchScore: score.score ?? 0,
      scoreType: score.type,
    };
  };

  const renderRequest = (request: MatchRequest, direction: RequestTab | 'conversation') => {
    const partner = toPartner(request);
    const hoursLeft = getRequestHoursLeft(request.expiresAt);
    const isExpired = hoursLeft === 0;
    const timer = isExpired
      ? '만료됨'
      : hoursLeft < 24
        ? `${hoursLeft}시간`
        : `D-${Math.ceil(hoursLeft / 24)}`;
    const isReceived = direction === 'received';
    const isConversation = direction === 'conversation';

    return (
      <MatchingCompactCard
        key={request.id}
        nickname={partner.nickname}
        dormitoryId={partner.dormitoryId}
        matchScore={partner.matchScore}
        scoreType={partner.scoreType}
        status={{
          label: isConversation ? '대화 중' : isReceived ? '응답 필요' : '수락 대기 중',
          color: isConversation ? 'text-emerald-600' : 'text-purple-600',
          dotColor: isConversation ? 'bg-emerald-500' : 'bg-purple-400',
        }}
        message={request.message}
        timer={{
          text: isConversation ? `남은 시간 ${timer}` : timer,
          expired: isExpired,
          urgent: hoursLeft < 24 && !isExpired,
        }}
        actions={
          isConversation
            ? [
                {
                  label: '확정하기',
                  icon: <Check className="h-3.5 w-3.5" />,
                  variant: 'primary',
                  onClick: () =>
                    setDialog({
                      title: '매칭 확정',
                      message: `${partner.nickname}님과 매칭을 확정할까요?`,
                      onConfirm: () => onConfirmMatch(request.id),
                    }),
                },
                {
                  label: '대화 종료',
                  icon: <X className="h-3.5 w-3.5" />,
                  variant: 'secondary',
                  onClick: () =>
                    setDialog({
                      title: '대화 종료',
                      message: '대화를 종료할까요?',
                      onConfirm: () => onEndConversation(request.id),
                      variant: 'danger',
                    }),
                },
              ]
            : isReceived
              ? [
                  {
                    label: '거절',
                    variant: 'secondary',
                    onClick: () =>
                      setDialog({
                        title: '요청 거절',
                        message: '매칭 요청을 거절할까요?',
                        onConfirm: () => onRejectRequest(request.id),
                        variant: 'danger',
                      }),
                  },
                  {
                    label: '수락하기',
                    variant: 'primary',
                    onClick: () =>
                      setDialog({
                        title: '요청 수락',
                        message: `${partner.nickname}님과 대화를 시작할까요?`,
                        onConfirm: () => onAcceptRequest(request.id),
                      }),
                  },
                ]
              : [
                  {
                    label: '요청 취소',
                    variant: isExpired ? 'disabled' : 'danger',
                    onClick: () =>
                      setDialog({
                        title: '요청 취소',
                        message: '보낸 요청을 취소할까요?',
                        onConfirm: () => onCancelRequest(request.id),
                        variant: 'danger',
                      }),
                  },
                ]
        }
        menuItems={[
          { label: '프로필 보기', icon: <User className="h-4 w-4" />, onClick: () => undefined },
          ...(isConversation
            ? [{ label: '확정 취소', onClick: () => onRevokeConfirmMatch(request.id) }]
            : []),
        ]}
      />
    );
  };

  if (activeMatch) {
    return (
      <div className={`min-h-screen ${matchingStageBackground}`}>
        <LegacyMatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
        <div className="mx-auto max-w-md space-y-4 px-5 py-5">
          <PolicyHintBanner hints={policyHints} />
          <ActiveMatchCard
            nickname={activeMatch.partnerNickname}
            dormitoryId={activeMatch.partnerDormitoryId}
            matchScore={activeMatch.matchScore}
            scoreType={activeMatch.scoreType}
            cancelPending={activeMatch.cancelRequestedAt !== null}
            cancelRequestedByCurrentUser={activeMatch.cancelRequestedBy === user.id}
            cancelRequestKind={activeMatch.cancelRequestKind}
            onViewProfile={() => undefined}
            onRelease={() =>
              setDialog({
                title: '매칭 취소',
                message: '매칭을 취소할까요?',
                onConfirm: onEndMatch,
                variant: 'danger',
              })
            }
          />
        </div>
        {dialog && <ConfirmDialog isOpen onClose={() => setDialog(null)} {...dialog} />}
      </div>
    );
  }

  const orderedReceived = [...receivedPending].sort((left, right) =>
    receivedSort === 'matchScore'
      ? toPartner(right).matchScore - toPartner(left).matchScore
      : new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const visibleRequests = requestTab === 'sent' ? sentPending : orderedReceived;

  return (
    <div className={`min-h-screen ${matchingStageBackground}`}>
      <LegacyMatchingTabHeader user={user} onNavigateProfile={() => onNavigate('profile')} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <PolicyHintBanner hints={policyHints} />
        {conversations.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MessageCircle className="h-4 w-4" />
              대화 중
            </h2>
            {conversations.map((request) => renderRequest(request, 'conversation'))}
          </section>
        )}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">요청 관리</h2>
          <SegmentControl
            options={[
              {
                id: 'sent',
                label: `보낸 요청 (${sentPending.length}/${MATCH_POLICY.MAX_PENDING_REQUESTS})`,
              },
              { id: 'received', label: '받은 요청', badge: receivedPending.length },
            ]}
            selected={requestTab}
            onChange={(value) => setRequestTab(value as RequestTab)}
          />
          {requestTab === 'received' && receivedPending.length > 0 && (
            <div className="flex justify-end">
              <SortToggle value={receivedSort} onChange={setReceivedSort} />
            </div>
          )}
          {visibleRequests.length > 0 ? (
            visibleRequests.map((request) => renderRequest(request, requestTab))
          ) : (
            <MatchingEmptyState
              title="대기 중인 요청이 없어요"
              description="룸메이트를 둘러보고 요청을 보내보세요."
              action={{ label: '룸메 찾기로 이동', onClick: () => onNavigate('list') }}
            />
          )}
        </section>
      </main>
      {dialog && <ConfirmDialog isOpen onClose={() => setDialog(null)} {...dialog} />}
    </div>
  );
}
