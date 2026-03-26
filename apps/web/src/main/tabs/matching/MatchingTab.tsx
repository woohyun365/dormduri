'use client';

import { useState, useMemo } from 'react';
import { Handshake, ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { MatchRequestCard } from '../../components/MatchRequestCard';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import { MATCH_POLICY } from '@/constants/match';
import { MATCH_STATUS_LABELS } from '@/constants/match';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import type { MatchScoreType } from '@/utils/matchScore';
import type { UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch, MatchStatus } from '@/types/match';

type RequestTab = 'sent' | 'received';

const TERMINAL_STATUSES: MatchStatus[] = [
  'EXPIRED',
  'REJECTED',
  'CANCELLED',
  'CONVERSATION_ENDED',
  'UNMATCHED',
];

interface MatchingTabProps {
  user: UserProfile;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  onCancelRequest: (requestId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onConfirmMatch: (requestId: string) => void;
  onEndConversation: (requestId: string) => void;
  onEndMatch: () => void;
}

const getPartnerId = (request: MatchRequest, currentUserId: string) =>
  request.fromUserId === currentUserId ? request.toUserId : request.fromUserId;

export default function MatchingTab({
  user,
  matchRequests,
  activeMatch,
  profiles,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onConfirmMatch,
  onEndConversation,
  onEndMatch,
}: MatchingTabProps) {
  // --- Derived data ---
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
        (r) => r.toUserId === user.id && r.status === 'PENDING' && !isRequestExpired(r),
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

  // --- UI state ---
  const [requestTab, setRequestTab] = useState<RequestTab>('sent');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'cancel' | 'reject' | 'accept' | 'confirmMatch' | 'endConversation' | 'endMatch';
    requestId?: string;
    nickname: string;
  } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<{
    profile: RoommateProfile & { scoreType: MatchScoreType };
    direction: 'sent' | 'received' | 'conversation';
    requestId: string;
  } | null>(null);

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
      title: '요청 수락',
      message: `${confirmAction?.nickname ?? ''}님의 매칭 요청을 수락하시겠습니까?\n수락 후 대화를 시작할 수 있어요.`,
      label: '수락하기',
      variant: 'default',
    },
    confirmMatch: {
      title: '매칭 확정',
      message: `${confirmAction?.nickname ?? ''}님과 매칭을 확정하시겠습니까?\n확정 후 다른 매칭 활동이 중단됩니다.`,
      label: '확정하기',
      variant: 'default',
    },
    endConversation: {
      title: '대화 종료',
      message: `${confirmAction?.nickname ?? ''}님과의 대화를 종료하시겠습니까?\n\n종료 후 같은 상대와 재교류할 수 없습니다.`,
      label: '종료하기',
      variant: 'danger',
    },
    endMatch: {
      title: '매칭 해제',
      message: `${activeMatch?.partnerNickname ?? ''}님과의 매칭을 해제하시겠습니까?\n\n해제 후 같은 상대와 재매칭할 수 없습니다.`,
      label: '해제하기',
      variant: 'danger',
    },
  };

  // --- [1] Active Match ---
  if (activeMatch) {
    const partnerProfile = getPartnerProfile(
      matchRequests.find((r) => r.status === 'ACTIVE') ?? matchRequests[0]!,
    );
    return (
      <div className="px-4 py-6 max-w-md mx-auto">
        <div className="bg-white rounded-2xl border-2 border-green-200 p-5">
          <div className="text-center mb-4">
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
              매칭 확정
            </span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div
              className={`w-14 h-14 ${getAvatarColor(activeMatch.partnerNickname).bg} rounded-2xl flex items-center justify-center text-2xl font-bold ${getAvatarColor(activeMatch.partnerNickname).text}`}
            >
              {activeMatch.partnerNickname.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg text-[var(--knu-text-primary)]">
                {activeMatch.partnerNickname}
              </p>
              <p className="text-sm text-[var(--knu-text-secondary)]">
                매칭도 {activeMatch.matchScore}%
                {activeMatch.partnerDormitoryId &&
                  ` · ${getDormitoryLabel(activeMatch.partnerDormitoryId)}`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-400 rounded-xl text-sm font-semibold cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" />
              대화 (준비 중)
            </button>
            <Button
              variant="outline"
              fullWidth
              onClick={() =>
                setSelectedProfile({
                  profile: partnerProfile,
                  direction: 'conversation',
                  requestId: '',
                })
              }
            >
              프로필 보기
            </Button>
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'endMatch',
                  nickname: activeMatch.partnerNickname,
                })
              }
              className="w-full py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              매칭 해제
            </button>
          </div>

          <p className="mt-4 text-xs text-center text-[var(--knu-text-tertiary)]">
            호실 선택은 학교 시스템에서 직접 진행해 주세요
          </p>
        </div>

        <ProfileDetailSheet
          profile={selectedProfile?.profile ?? null}
          scoreType={selectedProfile?.profile.scoreType}
          isOpen={selectedProfile !== null}
          onClose={() => setSelectedProfile(null)}
          onRequestMatch={() => {}}
          hideMatchButton
          userLifestyle={user.lifestyle}
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
      </div>
    );
  }

  // --- [2][3][4] No active match ---
  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-6">
      {/* [2] In Conversation */}
      {conversations.length > 0 && (
        <section className="bg-white rounded-2xl border-2 border-blue-200 p-5">
          <h3 className="font-bold text-[var(--knu-text-primary)] mb-4">
            대화 중 ({conversations.length})
          </h3>
          <div className="space-y-3">
            {conversations.map((req) => {
              const partner = getPartnerProfile(req);
              return (
                <div key={req.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <div
                    className={`w-10 h-10 ${getAvatarColor(partner.nickname).bg} rounded-full flex items-center justify-center text-lg font-bold ${getAvatarColor(partner.nickname).text}`}
                  >
                    {partner.nickname.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--knu-text-primary)] truncate">
                      {partner.nickname}
                    </p>
                    <p className="text-xs text-[var(--knu-text-tertiary)]">
                      매칭도 {partner.matchScore}%
                      {partner.dormitoryId && ` · ${getDormitoryLabel(partner.dormitoryId)}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        setConfirmAction({
                          type: 'confirmMatch',
                          requestId: req.id,
                          nickname: partner.nickname,
                        })
                      }
                      className="px-3 py-1.5 bg-[var(--knu-primary)] text-white text-xs font-semibold rounded-lg"
                    >
                      확정
                    </button>
                    <button
                      onClick={() =>
                        setConfirmAction({
                          type: 'endConversation',
                          requestId: req.id,
                          nickname: partner.nickname,
                        })
                      }
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg"
                    >
                      종료
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* [3] Request Management */}
      <section className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
        <h3 className="font-bold text-[var(--knu-text-primary)] mb-4">요청 관리</h3>

        <div className="flex bg-[var(--knu-background-alt)] rounded-xl p-1 mb-4">
          <button
            onClick={() => setRequestTab('sent')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              requestTab === 'sent'
                ? 'bg-white text-[var(--knu-primary)] shadow-sm'
                : 'text-[var(--knu-text-tertiary)]'
            }`}
          >
            보낸 요청 ({sentPending.length}/{MATCH_POLICY.MAX_PENDING_REQUESTS})
          </button>
          <button
            onClick={() => setRequestTab('received')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors relative ${
              requestTab === 'received'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-[var(--knu-text-tertiary)]'
            }`}
          >
            받은 요청
            {receivedPending.length > 0 && requestTab !== 'received' && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                {receivedPending.length}
              </span>
            )}
          </button>
        </div>

        <div className="space-y-3">
          {requestTab === 'sent' &&
            (sentPending.length > 0 ? (
              sentPending.map((req) => {
                const partner = getPartnerProfile(req);
                return (
                  <MatchRequestCard
                    key={req.id}
                    request={req}
                    direction="sent"
                    partnerProfile={partner}
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
              <p className="text-sm text-center text-[var(--knu-text-tertiary)] py-4">
                보낸 요청이 없어요
              </p>
            ))}

          {requestTab === 'received' &&
            (receivedPending.length > 0 ? (
              receivedPending.map((req) => {
                const partner = getPartnerProfile(req);
                return (
                  <MatchRequestCard
                    key={req.id}
                    request={req}
                    direction="received"
                    partnerProfile={partner}
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
              })
            ) : (
              <p className="text-sm text-center text-[var(--knu-text-tertiary)] py-4">
                받은 요청이 없어요
              </p>
            ))}
        </div>
      </section>

      {/* [4] History */}
      {history.length > 0 && (
        <section className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-bold text-[var(--knu-text-primary)]">이력 ({history.length})</h3>
            {historyOpen ? (
              <ChevronDown className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            )}
          </button>

          {historyOpen && (
            <div className="mt-4 space-y-3">
              {history.map((req) => {
                const partnerId = getPartnerId(req, user.id);
                const partnerNickname = profileMap.get(partnerId)?.nickname ?? partnerId;
                const dormId = profileMap.get(partnerId)?.dormitoryId;
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl opacity-70"
                  >
                    <div
                      className={`w-9 h-9 ${getAvatarColor(partnerNickname).bg} rounded-full flex items-center justify-center text-sm font-bold ${getAvatarColor(partnerNickname).text}`}
                    >
                      {partnerNickname.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--knu-text-secondary)] truncate">
                        {partnerNickname}
                      </p>
                      {dormId && (
                        <p className="text-xs text-[var(--knu-text-tertiary)]">
                          {getDormitoryLabel(dormId)}
                        </p>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                      {MATCH_STATUS_LABELS[req.status]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Empty state: no conversations, no requests, no history */}
      {conversations.length === 0 &&
        sentPending.length === 0 &&
        receivedPending.length === 0 &&
        history.length === 0 && (
          <EmptyState
            icon={<Handshake className="w-12 h-12 text-gray-300" />}
            message="아직 매칭 활동이 없어요"
          />
        )}

      {/* Profile Detail Sheet */}
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
              <Button
                variant="outline"
                fullWidth
                onClick={() =>
                  setConfirmAction({
                    type: 'cancel',
                    requestId: selectedProfile.requestId,
                    nickname: selectedProfile.profile.nickname,
                  })
                }
              >
                요청 취소
              </Button>
            ) : selectedProfile.direction === 'received' ? (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() =>
                      setConfirmAction({
                        type: 'reject',
                        requestId: selectedProfile.requestId,
                        nickname: selectedProfile.profile.nickname,
                      })
                    }
                  >
                    거절
                  </Button>
                </div>
                <div className="flex-1">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() =>
                      setConfirmAction({
                        type: 'accept',
                        requestId: selectedProfile.requestId,
                        nickname: selectedProfile.profile.nickname,
                      })
                    }
                  >
                    수락
                  </Button>
                </div>
              </div>
            ) : undefined
          ) : undefined
        }
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmAction ? confirmMessages[confirmAction.type]!.title : ''}
        message={confirmAction ? confirmMessages[confirmAction.type]!.message : ''}
        confirmLabel={confirmAction ? confirmMessages[confirmAction.type]!.label : ''}
        variant={confirmAction ? confirmMessages[confirmAction.type]!.variant : 'default'}
      />
    </div>
  );
}
