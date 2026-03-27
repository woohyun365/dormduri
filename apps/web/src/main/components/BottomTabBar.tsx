'use client';

import { Home, Users, Handshake, User, Settings } from 'lucide-react';
import type { TabId } from '@/types/profile';

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'list', label: '룸메 찾기', icon: Users },
  { id: 'matching', label: '매칭 현황', icon: Handshake },
  { id: 'profile', label: '프로필', icon: User },
  { id: 'settings', label: '설정', icon: Settings },
];

export function BottomTabBar({ activeTab, onTabChange, badges }: BottomTabBarProps) {
  return (
    <nav
      aria-label="메인 네비게이션"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-[var(--knu-border)]"
    >
      <div className="max-w-md mx-auto flex">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const badge = badges?.[id];
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative ${
                isActive ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
