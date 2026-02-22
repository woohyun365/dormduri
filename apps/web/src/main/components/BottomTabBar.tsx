'use client';

import { Home, Users, User, Settings } from 'lucide-react';
import type { TabId } from '@/types/profile';

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'list', label: '룸메 찾기', icon: Users },
  { id: 'profile', label: '프로필', icon: User },
  { id: 'settings', label: '설정', icon: Settings },
];

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav
      aria-label="메인 네비게이션"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-[var(--knu-border)]"
    >
      <div className="max-w-md mx-auto flex" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
