'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calendar,
  Users,
  Inbox,
  TrendingUp,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { getDormitoryById, getMatchGroupSize, UNASSIGNED_ID } from '@/constants/dormitory';
import { CURRENT_SEASON } from '@/constants/season';
import { PROFILE_COMPLETION } from '@/constants/ui';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { isRequestExpired } from '@/utils/matchRequest';
import { MatchRequestCard } from '../components/MatchRequestCard';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';

interface HomeTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  onShowGuide?: () => void;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  onCancelRequest?: (requestId: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onEndMatch?: () => void;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
}

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const sm = start.getMonth() + 1;
  const em = end.getMonth() + 1;
  if (sm === em) {
    return `${sm}월 ${start.getDate()}일 ~ ${end.getDate()}일`;
  }
  return `${sm}월 ${start.getDate()}일 ~ ${em}월 ${end.getDate()}일`;
}

type RequestTab = 'sent' | 'received';

export default function HomeTab({
  user,
  onNavigate,
  onShowGuide,
  matchRequests,
  activeMatch,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onEndMatch,
  profiles,
}: HomeTabProps) {
  const isUnassigned = user.dormitoryId === UNASSIGNED_ID;
  const dormitory = user.dormitoryId && !isUnassigned ? getDormitoryById(user.dormitoryId) : null;

  const matchSectionRef = useRef<HTMLDivElement>(null);

  // Refresh D-day at midnight
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const timer = setTimeout(() => setDateKey(new Date().toDateString()), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [dateKey]);

  const { dDay, roomSelectionDateStr } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(CURRENT_SEASON.roomSelectionStart + 'T00:00:00');
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return {
      dDay: Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
      roomSelectionDateStr: formatDateRange(
        CURRENT_SEASON.roomSelectionStart,
        CURRENT_SEASON.roomSelectionEnd,
      ),
    };
  }, [dateKey]);

  // Profile completeness
  const optionalFields = [
    user.messageToRoommate,
    user.additional.college,
    user.additional.grade,
    user.additional.mbti,
    user.additional.temperatureSensitivity,
  ];
  const filledOptional = optionalFields.filter(Boolean).length;
  const totalOptional = optionalFields.length;
  const completionPercent = Math.round(
    PROFILE_COMPLETION.base + (filledOptional / totalOptional) * PROFILE_COMPLETION.optional,
  );
  const hasAllOptional = filledOptional === totalOptional;

  // Mock building stats
  const buildingActiveUsers = 47;

  // --- Matching state derived ---
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

  // Profile lookup helper
  const profileMap = useMemo(() => {
    const map = new Map<string, Omit<RoommateProfile, 'matchScore'>>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    return map;
  }, [profiles]);

  const getPartnerProfile = (request: MatchRequest) => {
    const partnerId = request.fromUserId === 'me' ? request.toUserId : request.fromUserId;
    const p = profileMap.get(partnerId);
    if (p) return { ...p, matchScore: 0 };
    return {
      id: partnerId,
      nickname: partnerId,
      gender: 'M' as const,
      dormitoryId: null,
      lifestyle: {} as RoommateProfile['lifestyle'],
      intro: '',
      messageToRoommate: null,
      additional: { college: null, grade: null, mbti: null, temperatureSensitivity: null },
      matchScore: 0,
    };
  };

  // End match confirm dialog
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);

  const scrollToMatchSection = () => {
    matchSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-[var(--knu-primary)] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <p className="text-sm opacity-90 mb-1">안녕하세요,</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{user.nickname}님</h1>
            <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full">
              {user.gender === 'M' ? '남' : '여'}
            </span>
          </div>
          {dormitory ? (
            <div className="mt-2 flex items-center gap-2 text-sm opacity-90">
              <Building2 className="w-4 h-4" />
              <span>
                {dormitory.name} · {dormitory.roomType}인실
              </span>
            </div>
          ) : isUnassigned ? (
            <div className="mt-2 flex items-center gap-2 text-sm opacity-75">
              <AlertTriangle className="w-4 h-4" />
              <span>건물 미배정</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        {/* ① Season Banner */}
        <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${CURRENT_SEASON.isActive ? 'bg-green-500' : 'bg-gray-400'}`}
              />
              <h3 className="font-bold text-[var(--knu-text-primary)]">
                {CURRENT_SEASON.isActive ? '매칭 시즌 진행중' : '비시즌'}
              </h3>
            </div>
            <Calendar className="w-5 h-5 text-[var(--knu-primary)]" />
          </div>
          <p className="text-sm text-[var(--knu-text-secondary)] mb-3">{CURRENT_SEASON.name}</p>
          {CURRENT_SEASON.isActive ? (
            <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">호실 선택일</p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {roomSelectionDateStr}
                </p>
              </div>
              <div
                className={`px-3 py-1.5 rounded-lg font-bold text-sm ${
                  dDay > 0
                    ? 'bg-[var(--knu-primary-light)] text-[var(--knu-primary)]'
                    : dDay === 0
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-[var(--knu-text-tertiary)]'
                }`}
              >
                {dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day' : '종료'}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
              <p className="text-sm text-[var(--knu-text-secondary)]">
                다음 시즌 일정이 공지되면 알려드릴게요.
              </p>
            </div>
          )}
        </div>

        {/* ② Matching Status */}
        <div
          ref={matchSectionRef}
          className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--knu-text-primary)]">매칭 현황</h3>
            {dormitory && (
              <span className="px-2.5 py-1 bg-[var(--knu-background-alt)] text-[var(--knu-text-tertiary)] text-xs font-semibold rounded-full">
                {getMatchGroupSize(dormitory.id)}인 매칭
              </span>
            )}
          </div>

          {/* Case 1: Active match */}
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

          {/* Case 2: Pending requests */}
          {!activeMatch && hasPendingRequests && (
            <div>
              {/* Counts */}
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

              {/* Segment tabs */}
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

              {/* Request list */}
              <div className="space-y-3">
                {requestTab === 'sent' &&
                  (sentPending.length > 0 ? (
                    sentPending.map((req) => (
                      <MatchRequestCard
                        key={req.id}
                        request={req}
                        direction="sent"
                        partnerProfile={getPartnerProfile(req)}
                        onCancel={onCancelRequest}
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
                        onAccept={onAcceptRequest}
                        onReject={onRejectRequest}
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

          {/* Case 3: No match, no pending */}
          {!activeMatch && !hasPendingRequests && (
            <EmptyState message="아직 매칭 요청이 없어요. 아래 빠른 메뉴에서 룸메이트를 찾아보세요!" />
          )}
        </div>

        {/* ③ Quick Menu */}
        <div>
          <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">빠른 메뉴</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('list')}
              className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 hover:border-[var(--knu-primary)] hover:shadow-sm transition-all text-left"
            >
              <div className="w-12 h-12 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-[var(--knu-primary)]" />
              </div>
              <h3 className="font-bold text-[var(--knu-text-primary)] mb-1">룸메 찾기</h3>
              <p className="text-xs text-[var(--knu-text-tertiary)]">프로필 탐색하기</p>
            </button>

            <button
              onClick={scrollToMatchSection}
              className="relative bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 hover:border-orange-400 hover:shadow-sm transition-all text-left"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                <Inbox className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-bold text-[var(--knu-text-primary)] mb-1">받은 요청</h3>
              <p className="text-xs text-[var(--knu-text-tertiary)]">매칭 요청 확인</p>
              {receivedPending.length > 0 && (
                <span className="absolute top-3 right-3 min-w-[22px] h-[22px] flex items-center justify-center px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {receivedPending.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ④ My Building Status */}
        <div>
          <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">내 건물 현황</h2>
          {dormitory ? (
            <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[var(--knu-primary)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--knu-text-primary)]">{dormitory.name}</h3>
                    <div className="mt-1">
                      <Chip label={`${dormitory.roomType}인실`} variant="badge" />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--knu-primary)]">
                    {buildingActiveUsers}
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)]">같은 건물 활동 중</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-800 mb-1">
                    건물이 아직 배정되지 않았어요
                  </h3>
                  <p className="text-xs text-orange-700 mb-3 leading-relaxed">
                    건물이 배정되면 같은 건물 사용자를 확인하고 룸메이트 매칭을 받을 수 있어요.
                  </p>
                  <button
                    onClick={() => onNavigate('profile')}
                    className="flex items-center gap-1 text-sm font-semibold text-orange-700"
                  >
                    배정 건물 등록하기
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ⑤ Profile Completeness */}
        <div>
          <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">프로필 완성도</h2>
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                {completionPercent}%
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  hasAllOptional ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
                }`}
              >
                {hasAllOptional ? '완성' : `${filledOptional}/${totalOptional} 선택 항목`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[var(--knu-primary)] transition-all duration-300 rounded-full"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            {hasAllOptional ? (
              <p className="text-sm text-green-600 font-semibold">모든 항목이 입력되었어요!</p>
            ) : (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-2">미작성 항목</p>
                <div className="flex flex-wrap gap-1.5">
                  {!user.messageToRoommate && (
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                      룸메에게 한마디
                    </span>
                  )}
                  {!user.additional.college && (
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                      단대
                    </span>
                  )}
                  {!user.additional.grade && (
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                      학년
                    </span>
                  )}
                  {!user.additional.mbti && (
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                      MBTI
                    </span>
                  )}
                  {!user.additional.temperatureSensitivity && (
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                      온도 민감도
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onNavigate('profile')}
                  className="mt-3 flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
                >
                  프로필 완성하기
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ⑥ Usage Tips */}
        <div>
          <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">이용 팁</h2>
          <div className="bg-gradient-to-br from-[var(--knu-primary)] to-[var(--knu-primary-hover)] rounded-2xl p-5 text-white">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-2">
                  {CURRENT_SEASON.isActive
                    ? '시즌 중에 적극적으로 활동하세요'
                    : '비시즌에도 프로필을 완성해두세요'}
                </h3>
                <p className="text-sm opacity-90">
                  {CURRENT_SEASON.isActive
                    ? '호실 선택일 전에 룸메이트를 확정하면 함께 같은 방을 선택할 수 있어요. 생활패턴이 비슷한 룸메를 찾아보세요!'
                    : '시즌이 시작되면 바로 매칭을 시작할 수 있도록 미리 프로필을 완성해두세요.'}
                </p>
              </div>
            </div>
          </div>

          {/* Dormitory Guide Link */}
          {onShowGuide && (
            <button
              onClick={onShowGuide}
              className="mt-3 w-full flex items-center gap-3 bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 hover:border-[var(--knu-primary)] hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  기숙사 생활 가이드
                </p>
                <p className="text-xs text-[var(--knu-text-tertiary)]">
                  규정, 편의시설, 연락처 확인
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </button>
          )}
        </div>
      </div>

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
    </div>
  );
}
