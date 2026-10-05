'use client';

import Link from 'next/link';
import { mainRoutes } from '@/main/model/mainRoutes';
import { motion } from 'motion/react';
import { Home, Users, Handshake, MessageCircle, User } from 'lucide-react';
import type { TabId } from '@/main/model/navigation';

interface BottomTabBarProps {
  activeTab: TabId;
  badges?: Partial<Record<TabId, number>>;
  disabledTabs?: TabId[];
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'list', label: '룸메 찾기', icon: Users },
  { id: 'matching', label: '매칭 현황', icon: Handshake },
  { id: 'chat', label: '채팅', icon: MessageCircle },
  { id: 'profile', label: '프로필', icon: User },
];

export function BottomTabBar({ activeTab, badges, disabledTabs = [] }: BottomTabBarProps) {
  return (
    <nav
      aria-label="메인 네비게이션"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white pb-[env(safe-area-inset-bottom)] border-t-2 border-[(--knu-border)]"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const isDisabled = disabledTabs.includes(id);
          const badge = badges?.[id];
          const className = `relative flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-all focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${isDisabled ? 'text-[(--knu-text-tertiary)] cursor-not-allowed' : isActive ? 'text-[(--knu-primary)]' : 'text-[(--knu-text-tertiary)] hover:text-[(--knu-text-secondary)]'}`;
          const content = (
            <>
              <div className="relative">
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-4.5 h-4.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
              {isDisabled && <span className="text-[10px]">캠퍼스 운영 준비 중</span>}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[(--knu-primary)] rounded-t-full"
                />
              )}
            </>
          );
          return isDisabled ? (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={isDisabled || undefined}
              className={className}
            >
              {content}
            </button>
          ) : (
            <Link
              key={id}
              href={mainRoutes[id]}
              aria-current={isActive ? 'page' : undefined}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
