'use client';

import { motion } from 'motion/react';
import { Home, Users, Handshake, MessageCircle, User } from 'lucide-react';
import type { TabId } from '@/main/model/navigation';

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
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

export function BottomTabBar({
  activeTab,
  onTabChange,
  badges,
  disabledTabs = [],
}: BottomTabBarProps) {
  return (
    <nav
      aria-label="메인 네비게이션"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-[(--knu-border)]"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const isDisabled = disabledTabs.includes(id);
          const badge = badges?.[id];
          return (
            <motion.button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={isDisabled || undefined}
              onClick={isDisabled ? undefined : () => onTabChange(id)}
              whileTap={isDisabled ? undefined : { scale: 0.95 }}
              className={`relative flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-all ${
                isDisabled
                  ? 'text-[(--knu-text-tertiary)] opacity-40 cursor-not-allowed'
                  : isActive
                    ? 'text-[(--knu-primary)]'
                    : 'text-[(--knu-text-tertiary)] hover:text-[(--knu-text-secondary)]'
              }`}
            >
              <div className="relative">
                <motion.div
                  animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                </motion.div>
                {badge != null && badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-2 min-w-4.5 h-4.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1"
                  >
                    {badge > 99 ? '99+' : badge}
                  </motion.span>
                )}
              </div>
              <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[(--knu-primary)] rounded-t-full"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
