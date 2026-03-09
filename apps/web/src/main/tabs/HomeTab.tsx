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
import { getDormitoryById, getMatchGroupSize } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { CURRENT_SEASON, isSeasonActive } from '@/constants/season';
import { getAvatarColor } from '@/utils/avatarColor';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { isRequestExpired } from '@/utils/matchRequest';
import { BuildingStatusSheet } from '../components/BuildingStatusSheet';
import { MatchRequestCard } from '../components/MatchRequestCard';
import { ProfileDetailSheet } from '../components/ProfileDetailSheet';
import { Button } from '@/components/Button';
import { calcMatchScore } from '@/utils/matchScore';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { getChecklistItems, isChecklistComplete } from '@/utils/onboarding';
import type { ChecklistNavigateTo } from '@/utils/onboarding';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';

export interface BuildingStats {
  activeUsers: number;
  matchableUsers: number;
  todayNewUsers: number;
  popularCondition: string;
}

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
  buildingStats?: BuildingStats;
  bookmarkedUserIds?: Set<string>;
  isChecklistDismissed?: boolean;
  onDismissChecklist?: () => void;
  onOpenBuildingSelect?: () => void;
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
  buildingStats,
  bookmarkedUserIds,
  isChecklistDismissed,
  onDismissChecklist,
  onOpenBuildingSelect,
}: HomeTabProps) {
  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);

  // Checklist
  const checklistItems = useMemo(
    () => getChecklistItems(user, bookmarkedUserIds ?? new Set()),
    [user, bookmarkedUserIds],
  );
  const checklistComplete = isChecklistComplete(user, bookmarkedUserIds ?? new Set());
  const showChecklist = !checklistComplete && !isChecklistDismissed;

  const handleChecklistNavigate = (target: ChecklistNavigateTo) => {
    switch (target) {
      case 'building':
        onOpenBuildingSelect?.();
        break;
      case 'profile':
        onNavigate('profile');
        break;
      case 'list':
        onNavigate('list');
        break;
    }
  };
  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const seasonActive = isSeasonActive(CURRENT_SEASON);

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
    const today = new Date(dateKey);
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
  const {
    percent: completionPercent,
    filledOptional,
    totalOptional,
    isComplete: hasAllOptional,
  } = getProfileCompletion(user);

  // Building stats (mockDb 또는 API 기반)
  const buildingActiveUsers = buildingStats?.activeUsers ?? 0;
  const seasonPopularCondition = buildingStats?.popularCondition ?? '-';
  const todayNewUsers = buildingStats?.todayNewUsers ?? 0;
  const buildingMatchableUsers = buildingStats?.matchableUsers ?? 0;

  // Building status sheet
  const [showBuildingStatus, setShowBuildingStatus] = useState(false);

  // Filter profiles for same building (for distribution stats)
  const buildingProfiles = useMemo(
    () => (dormitory ? profiles.filter((p) => p.dormitoryId === dormitory.id) : []),
    [profiles, dormitory],
  );

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
    const partnerId = getPartnerId(request);
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

  // Profile detail sheet for match requests
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

  // Confirm dialog for match request actions
  const [confirmAction, setConfirmAction] = useState<{
    type: 'cancel' | 'reject' | 'accept';
    requestId: string;
    nickname: string;
  } | null>(null);

  const getPartnerNickname = (request: MatchRequest) =>
    profileMap.get(getPartnerId(request))?.nickname ?? getPartnerId(request);

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
          <p className="text-xl font-bold mb-4">안녕하세요,</p>
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 ${getAvatarColor(user.nickname).bg} rounded-2xl flex items-center justify-center text-2xl font-bold ${getAvatarColor(user.nickname).text}`}
            >
              {user.nickname.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{user.nickname}님</h1>
                <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full">
                  {user.gender === 'M' ? '남' : '여'}
                </span>
              </div>
              {dormitory ? (
                <div className="mt-1 flex items-center gap-2 text-sm opacity-90">
                  <Building2 className="w-4 h-4" />
                  <span>
                    {dormitory.name} · {dormitory.roomType}인실
                  </span>
                </div>
              ) : isUnassigned ? (
                <div className="mt-1 flex items-center gap-2 text-sm opacity-75">
                  <AlertTriangle className="w-4 h-4" />
                  <span>건물 미배정</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        {/* ① Season Banner */}
        <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${seasonActive ? 'bg-green-500' : 'bg-gray-400'}`}
              />
              <h3 className="font-bold text-[var(--knu-text-primary)]">
                {seasonActive ? '매칭 시즌 진행중' : '비시즌'}
              </h3>
            </div>
            <Calendar className="w-5 h-5 text-[var(--knu-primary)]" />
          </div>
          <p className="text-sm text-[var(--knu-text-secondary)] mb-3">{CURRENT_SEASON.name}</p>
          {seasonActive ? (
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

          {/* Case 3: No match, no pending */}
          {!activeMatch && !hasPendingRequests && (
            <EmptyState
              message="아직 매칭 요청이 없어요"
              action={{ label: '룸메이트 둘러보기', onClick: () => onNavigate('list') }}
            />
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
                    {buildingActiveUsers}명
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)]">같은 건물 활동 중</p>
                </div>
              </div>

              {/* Season Stats */}
              <div className="mt-4 pt-4 border-t border-[var(--knu-border)]">
                <p className="text-xs font-semibold text-[var(--knu-text-secondary)] mb-2">
                  시즌 통계
                </p>
                <div className="space-y-1.5">
                  <p className="text-xs text-[var(--knu-text-tertiary)]">
                    <span className="font-medium text-[var(--knu-text-secondary)]">인기 조건:</span>{' '}
                    {seasonPopularCondition}
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)]">
                    <span className="font-medium text-[var(--knu-text-secondary)]">
                      오늘 신규 가입:
                    </span>{' '}
                    {todayNewUsers}명
                  </p>
                </div>
              </div>

              {/* Detail trigger */}
              <div className="mt-3 pt-3 border-t border-[var(--knu-border)]">
                <button
                  onClick={() => setShowBuildingStatus(true)}
                  className="flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
                >
                  자세히 보기
                  <ChevronRight className="w-4 h-4" />
                </button>
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

        {/* ⑤ Onboarding Checklist / Profile Completeness */}
        {showChecklist ? (
          <OnboardingChecklist
            items={checklistItems}
            onNavigate={handleChecklistNavigate}
            onDismiss={() => onDismissChecklist?.()}
          />
        ) : (
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
        )}

        {/* ⑥ Usage Tips */}
        <div>
          <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">이용 팁</h2>
          <div className="bg-gradient-to-br from-[var(--knu-primary)] to-[var(--knu-primary-hover)] rounded-2xl p-5 text-white">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-2">
                  {seasonActive
                    ? '시즌 중에 적극적으로 활동하세요'
                    : '비시즌에도 프로필을 완성해두세요'}
                </h3>
                <p className="text-sm opacity-90">
                  {seasonActive
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

      {/* Profile Detail Sheet for Match Requests */}
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

      {/* Building Status Sheet */}
      {showBuildingStatus && dormitory && (
        <BuildingStatusSheet
          dormitoryName={dormitory.name}
          roomType={dormitory.roomType}
          activeUsers={buildingActiveUsers}
          matchableUsers={buildingMatchableUsers}
          todayNewUsers={todayNewUsers}
          profiles={buildingProfiles}
          onClose={() => setShowBuildingStatus(false)}
          onNavigateList={() => onNavigate('list')}
        />
      )}
    </div>
  );
}
