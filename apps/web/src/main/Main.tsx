'use client';

import { useState, useEffect } from 'react';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import HomeTab from './tabs/HomeTab';
import RoommateListTab from './tabs/RoommateListTab';
import ProfileTab from './tabs/ProfileTab';
import SettingsTab from './tabs/SettingsTab';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import type { LifestyleData } from '@/signup/components/StepLifestyleProfile';
import type { AdditionalProfile } from '@/constants/additional-profile';

export type TabId = 'home' | 'list' | 'profile' | 'settings';

export interface UserProfile {
  nickname: string;
  gender: 'M' | 'F';
  dormitoryId: string | null;
  lifestyle: LifestyleData;
  intro: string;
  messageToRoommate: string | null;
  additional: AdditionalProfile;
}

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

  const handleSelectDormitory = (dormitoryId: string) => {
    setUser((prev) => ({ ...prev, dormitoryId }));
    if (dormitoryId === UNASSIGNED_ID) {
      setToast('건물 미배정으로 설정했어요');
    } else {
      const dorm = getDormitoryById(dormitoryId);
      setToast(dorm ? `${dorm.name}(으)로 설정했어요` : '건물이 설정되었어요');
    }
    if (!hasSeenGuide) {
      setTimeout(() => setShowGuide(true), 600);
    }
  };

  const handleCloseGuide = () => {
    setShowGuide(false);
    setHasSeenGuide(true);
  };

  const handleShowGuide = () => {
    setShowGuide(true);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab user={user} onNavigate={setActiveTab} onShowGuide={handleShowGuide} />;
      case 'list':
        return <RoommateListTab user={user} onNavigate={setActiveTab} />;
      case 'profile':
        return (
          <ProfileTab
            user={user}
            onDormitoryChange={handleSelectDormitory}
            onIntroChange={(intro) => setUser((prev) => ({ ...prev, intro }))}
            onMessageChange={(msg) => setUser((prev) => ({ ...prev, messageToRoommate: msg }))}
            onLifestyleChange={(lifestyle) => setUser((prev) => ({ ...prev, lifestyle }))}
            onAdditionalChange={(additional) => setUser((prev) => ({ ...prev, additional }))}
          />
        );
      case 'settings':
        return <SettingsTab onShowGuide={handleShowGuide} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
      {user.dormitoryId === null && (
        <BuildingSelectModal gender={user.gender} onSelect={handleSelectDormitory} />
      )}
      {renderTab()}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Dormitory Guide Sheet */}
      {showGuide && user.dormitoryId && (
        <DormitoryGuideSheet dormitoryId={user.dormitoryId} onClose={handleCloseGuide} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
