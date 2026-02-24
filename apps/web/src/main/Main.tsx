'use client';

import { useState, useEffect, useCallback } from 'react';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import HomeTab from './tabs/HomeTab';
import RoommateListTab from './tabs/RoommateListTab';
import ProfileTab from './tabs/ProfileTab';
import SettingsTab from './tabs/SettingsTab';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import { TOAST_DURATION, GUIDE_DELAY } from '@/constants/ui';
import type { TabId, UserProfile } from '@/types/profile';
import type { BlockedUser, ReportReason } from '@/types/report';

export type { TabId, UserProfile } from '@/types/profile';

export default function Main() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [hasSeenGuide, setHasSeenGuide] = useState(false);
  const [user, setUser] = useState<UserProfile>({
    nickname: '곰두리',
    gender: 'M',
    dormitoryId: null,
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'OK',
      bedtime: '22_24',
      wakeTime: '06_08',
      noiseSensitivity: 'MID',
      cleanliness: 'HIGH',
      relationshipStyle: 'CLOSE',
    },
    intro: '조용하고 규칙적인 생활을 선호합니다. 서로 존중하며 지낼 룸메이트를 찾습니다.',
    messageToRoommate: null,
    additional: {
      college: null,
      grade: null,
      mbti: null,
      temperatureSensitivity: null,
    },
  });

  const handleSelectDormitory = useCallback(
    (dormitoryId: string) => {
      setUser((prev) => ({ ...prev, dormitoryId }));
      if (dormitoryId === UNASSIGNED_ID) {
        setToast('건물 미배정으로 설정했어요');
      } else {
        const dorm = getDormitoryById(dormitoryId);
        setToast(dorm ? `${dorm.name}(으)로 설정했어요` : '건물이 설정되었어요');
      }
      if (!hasSeenGuide) {
        setTimeout(() => setShowGuide(true), GUIDE_DELAY);
      }
    },
    [hasSeenGuide],
  );

  const handleCloseGuide = useCallback(() => {
    setShowGuide(false);
    setHasSeenGuide(true);
  }, []);

  const handleShowGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  const handleIntroChange = useCallback((intro: string) => {
    setUser((prev) => ({ ...prev, intro }));
    setToast('자기소개가 저장되었어요');
  }, []);

  const handleMessageChange = useCallback((msg: string | null) => {
    setUser((prev) => ({ ...prev, messageToRoommate: msg }));
    setToast('룸메에게 한마디가 저장되었어요');
  }, []);

  const handleLifestyleChange = useCallback((lifestyle: UserProfile['lifestyle']) => {
    setUser((prev) => ({ ...prev, lifestyle }));
    setToast('생활패턴이 저장되었어요');
  }, []);

  const handleAdditionalChange = useCallback((additional: UserProfile['additional']) => {
    setUser((prev) => ({ ...prev, additional }));
  }, []);

  // --- Block / Report state ---
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [reportedUserIds, setReportedUserIds] = useState<Set<string>>(new Set());

  const handleBlockUser = useCallback((userId: string, nickname: string) => {
    setBlockedUsers((prev) => {
      if (prev.some((u) => u.userId === userId)) return prev;
      return [...prev, { userId, nickname, blockedAt: new Date().toISOString() }];
    });
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
    setToast(`${nickname}님을 차단했어요`);
  }, []);

  const handleUnblockUser = useCallback((userId: string) => {
    setBlockedUsers((prev) => {
      const user = prev.find((u) => u.userId === userId);
      if (user) {
        setTimeout(() => setToast(`${user.nickname}님의 차단을 해제했어요`), 0);
      }
      return prev.filter((u) => u.userId !== userId);
    });
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const handleReportUser = useCallback(
    (userId: string, _reason: ReportReason, _detail: string | null) => {
      if (reportedUserIds.has(userId)) {
        setToast('이미 신고한 사용자예요');
        return;
      }
      setReportedUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      setToast('신고가 접수되었어요');
    },
    [reportedUserIds],
  );

  // 탭 전환 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), TOAST_DURATION);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
      {user.dormitoryId === null && (
        <BuildingSelectModal gender={user.gender} onSelect={handleSelectDormitory} />
      )}
      {/* CSS hidden-based tab switching for state preservation */}
      <main>
        <div className={activeTab !== 'home' ? 'hidden' : undefined}>
          <HomeTab user={user} onNavigate={setActiveTab} onShowGuide={handleShowGuide} />
        </div>
        <div className={activeTab !== 'list' ? 'hidden' : undefined}>
          <RoommateListTab
            user={user}
            onNavigate={setActiveTab}
            blockedUserIds={blockedUserIds}
            onBlock={handleBlockUser}
            onReport={handleReportUser}
          />
        </div>
        <div className={activeTab !== 'profile' ? 'hidden' : undefined}>
          <ProfileTab
            user={user}
            onDormitoryChange={handleSelectDormitory}
            onIntroChange={handleIntroChange}
            onMessageChange={handleMessageChange}
            onLifestyleChange={handleLifestyleChange}
            onAdditionalChange={handleAdditionalChange}
          />
        </div>
        <div className={activeTab !== 'settings' ? 'hidden' : undefined}>
          <SettingsTab
            onShowGuide={handleShowGuide}
            blockedUsers={blockedUsers}
            onUnblock={handleUnblockUser}
          />
        </div>
      </main>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Dormitory Guide Sheet */}
      {showGuide && user.dormitoryId && (
        <DormitoryGuideSheet dormitoryId={user.dormitoryId} onClose={handleCloseGuide} />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
