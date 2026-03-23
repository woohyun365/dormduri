import { forwardRef, useState, useMemo } from 'react';
import { UserCheck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { getMatchGroupSize } from '@/constants/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScore } from '@/utils/matchScore';
import { MatchRequestCard } from '../../components/MatchRequestCard';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import type { Dormitory } from '@/constants/dormitory';
import type { UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';

type RequestTab = 'sent' | 'received';

const CONFIRM_CONFIG = {
  cancel: { title: '요청 취소', confirmLabel: '취소하기', variant: 'default' as const },
  reject: { title: '요청 거절', confirmLabel: '거절하기', variant: 'danger' as const },
  accept: { title: '요청 수락', confirmLabel: '수락하기', variant: 'default' as const },
};
const CONFIRM_MESSAGE = {
  cancel: (name: string) => `${name}님에게 보낸 매칭 요청을 취소하시겠습니까?`,
  reject: (name: string) => `${name}님의 매칭 요청을 거절하시겠습니까?`,
  accept: (name: string) => `${name}님의 매칭 요청을 수락하시겠습니까?`,
};

const noop = () => {};

const getPartnerId = (request: MatchRequest) =>
  request.fromUserId === 'me' ? request.toUserId : request.fromUserId;

interface HomeMatchingSectionProps {
  user: UserProfile;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  dormitory: Dormitory | null;
  onCancelRequest?: (requestId: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onEndMatch?: () => void;
  onNavigateList: () => void;
}

export const HomeMatchingSection = forwardRef<HTMLDivElement, HomeMatchingSectionProps>(
  function HomeMatchingSection(
    {
      user,
      matchRequests,
      activeMatch,
      profiles,
      dormitory,
      onCancelRequest,
      onAcceptRequest,
      onRejectRequest,
      onEndMatch,
      onNavigateList,
    },
    ref,
  ) {
    const sentPending = useMemo(
      () =>
        matchRequests.filter(
          (r) => r.fromUserId === 'me' && r.status === 'PENDING' && !isRequestExpired(r),
        ),
      [matchRequests],
    );
    const receivedPending = useMemo(
      () =>
        matchRequests.filter(
          (r) => r.toUserId === 'me' && r.status === 'PENDING' && !isRequestExpired(r),
        ),
      [matchRequests],
    );
    const hasPendingRequests = sentPending.length > 0 || receivedPending.length > 0;

    const [requestTab, setRequestTab] = useState<RequestTab>('sent');

    const profileMap = useMemo(() => {
      const map = new Map<string, Omit<RoommateProfile, 'matchScore'>>();
      for (const p of profiles) {
        map.set(p.id, p);
      }
      return map;
    }, [profiles]);

    const getPartnerProfile = (request: MatchRequest) => {
      const partnerId = getPartnerId(request);
      const p = profileMap.get(partnerId);
      if (p) return { ...p, matchScore: 0 };
      return {
        id: partnerId,
        nickname: partnerId,
        gender: 'M' as const,
        campus: 'CHUNCHEON' as const,
        dormitoryId: null,
        lifestyle: {} as RoommateProfile['lifestyle'],
        intro: '',
        messageToRoommate: null,
        additional: { college: null, grade: null, mbti: null, birthYear: null },
        matchScore: 0,
      };
    };

    const getPartnerNickname = (request: MatchRequest) =>
      profileMap.get(getPartnerId(request))?.nickname ?? getPartnerId(request);

    // Profile detail sheet
    const [selectedRequest, setSelectedRequest] = useState<{
      request: MatchRequest;
      direction: 'sent' | 'received';
    } | null>(null);

    const selectedProfile = useMemo<RoommateProfile | null>(() => {
      if (!selectedRequest) return null;
      const partnerId = getPartnerId(selectedRequest.request);
      const p = profileMap.get(partnerId);
      if (!p) return null;
      return {
        ...p,
        matchScore: calcMatchScore(user.lifestyle, p.lifestyle),
      };
    }, [selectedRequest, profileMap, user.lifestyle]);

    // Confirm dialog
    const [confirmAction, setConfirmAction] = useState<{
      type: 'cancel' | 'reject' | 'accept';
      requestId: string;
      nickname: string;
    } | null>(null);

    const handleConfirmAction = () => {
      if (!confirmAction) return;
      switch (confirmAction.type) {
        case 'cancel':
          onCancelRequest?.(confirmAction.requestId);
          break;
        case 'reject':
          onRejectRequest?.(confirmAction.requestId);
          break;
        case 'accept':
          onAcceptRequest?.(confirmAction.requestId);
          break;
      }
      setSelectedRequest(null);
      setConfirmAction(null);
    };

    // End match confirm
    const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);

    return (
      <>
        <div ref={ref} className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--knu-text-primary)]">매칭 현황</h3>
            {dormitory && (
              <span className="px-2.5 py-1 bg-[var(--knu-background-alt)] text-[var(--knu-text-tertiary)] text-xs font-semibold rounded-full">
                {getMatchGroupSize(dormitory.id)}인 매칭
              </span>
            )}
          </div>

          {/* Active match */}
          {activeMatch && (
            <div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200 mb-3">
                <div
                  className={`w-10 h-10 ${getAvatarColor(activeMatch.partnerNickname).bg} rounded-full flex items-center justify-center text-lg font-bold ${getAvatarColor(activeMatch.partnerNickname).text}`}
                >
                  {activeMatch.partnerNickname.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--knu-text-primary)]">
                    {activeMatch.partnerNickname}님과 매칭!
                  </p>
                  <p className="text-xs text-green-700">
                    매칭도 {activeMatch.matchScore}%
                    {activeMatch.partnerDormitoryId &&
                      ` · ${getDormitoryLabel(activeMatch.partnerDormitoryId)}`}
                  </p>
                </div>
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <button
                onClick={() => setShowEndMatchConfirm(true)}
                className="w-full py-2.5 text-sm font-semibold text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                매칭 해제
              </button>
            </div>
          )}

          {/* Pending requests */}
          {!activeMatch && hasPendingRequests && (
            <div>
              <div className="flex gap-4 mb-4">
                <div className="flex-1 text-center p-3 bg-[var(--knu-background-alt)] rounded-xl">
                  <p className="text-2xl font-bold text-[var(--knu-primary)]">
                    {sentPending.length}
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)] mt-1">보낸 요청</p>
                </div>
                <div className="flex-1 text-center p-3 bg-[var(--knu-background-alt)] rounded-xl">
                  <p className="text-2xl font-bold text-orange-600">{receivedPending.length}</p>
                  <p className="text-xs text-[var(--knu-text-tertiary)] mt-1">받은 요청</p>
                </div>
              </div>

              <div className="flex bg-[var(--knu-background-alt)] rounded-xl p-1 mb-4">
                <button
                  onClick={() => setRequestTab('sent')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    requestTab === 'sent'
                      ? 'bg-white text-[var(--knu-primary)] shadow-sm'
                      : 'text-[var(--knu-text-tertiary)]'
                  }`}
                >
                  보낸 요청
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
                    sentPending.map((req) => (
                      <MatchRequestCard
                        key={req.id}
                        request={req}
                        direction="sent"
                        partnerProfile={getPartnerProfile(req)}
                        onCancel={(id) =>
                          setConfirmAction({
                            type: 'cancel',
                            requestId: id,
                            nickname: getPartnerNickname(req),
                          })
                        }
                        onClick={() => setSelectedRequest({ request: req, direction: 'sent' })}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-center text-[var(--knu-text-tertiary)] py-4">
                      보낸 요청이 없어요
                    </p>
                  ))}
                {requestTab === 'received' &&
                  (receivedPending.length > 0 ? (
                    receivedPending.map((req) => (
                      <MatchRequestCard
                        key={req.id}
                        request={req}
                        direction="received"
                        partnerProfile={getPartnerProfile(req)}
                        onAccept={(id) =>
                          setConfirmAction({
                            type: 'accept',
                            requestId: id,
                            nickname: getPartnerNickname(req),
                          })
                        }
                        onReject={(id) =>
                          setConfirmAction({
                            type: 'reject',
                            requestId: id,
                            nickname: getPartnerNickname(req),
                          })
                        }
                        onClick={() => setSelectedRequest({ request: req, direction: 'received' })}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-center text-[var(--knu-text-tertiary)] py-4">
                      받은 요청이 없어요
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* No match, no pending */}
          {!activeMatch && !hasPendingRequests && (
            <EmptyState
              message="아직 매칭 요청이 없어요"
              action={{ label: '룸메이트 둘러보기', onClick: onNavigateList }}
            />
          )}
        </div>

        {/* Profile Detail Sheet */}
        <ProfileDetailSheet
          profile={selectedProfile}
          isOpen={selectedProfile !== null}
          onClose={() => setSelectedRequest(null)}
          onRequestMatch={noop}
          hideMatchButton
          userLifestyle={user.lifestyle}
          customFooter={
            selectedRequest ? (
              selectedRequest.direction === 'sent' ? (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() =>
                    setConfirmAction({
                      type: 'cancel',
                      requestId: selectedRequest.request.id,
                      nickname: getPartnerNickname(selectedRequest.request),
                    })
                  }
                >
                  요청 취소
                </Button>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() =>
                        setConfirmAction({
                          type: 'reject',
                          requestId: selectedRequest.request.id,
                          nickname: getPartnerNickname(selectedRequest.request),
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
                          requestId: selectedRequest.request.id,
                          nickname: getPartnerNickname(selectedRequest.request),
                        })
                      }
                    >
                      수락
                    </Button>
                  </div>
                </div>
              )
            ) : undefined
          }
        />

        {/* Match Action Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          title={confirmAction ? CONFIRM_CONFIG[confirmAction.type].title : ''}
          message={confirmAction ? CONFIRM_MESSAGE[confirmAction.type](confirmAction.nickname) : ''}
          confirmLabel={confirmAction ? CONFIRM_CONFIG[confirmAction.type].confirmLabel : ''}
          variant={confirmAction ? CONFIRM_CONFIG[confirmAction.type].variant : 'default'}
        />

        {/* End Match Confirm Dialog */}
        <ConfirmDialog
          isOpen={showEndMatchConfirm}
          onClose={() => setShowEndMatchConfirm(false)}
          onConfirm={() => onEndMatch?.()}
          title="매칭 해제"
          message={`${activeMatch?.partnerNickname ?? '상대방'}님과의 매칭을 해제하시겠습니까?\n\n해제 후 다시 룸메이트를 찾을 수 있어요.`}
          confirmLabel="해제하기"
          variant="danger"
        />
      </>
    );
  },
);
