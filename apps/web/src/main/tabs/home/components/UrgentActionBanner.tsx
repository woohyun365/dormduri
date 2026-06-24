'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, ChevronRight } from 'lucide-react';
import { isRequestExpired } from '@/utils/matchRequest';
import type { MatchRequest } from '@/types/match';
import type { RoommateProfile, TabId } from '@/types/profile';

const URGENT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24시간

export interface UrgentActionBannerProps {
  matchRequests: MatchRequest[];
  userId: string;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  onNavigate: (tab: TabId) => void;
}

export function UrgentActionBanner({
  matchRequests,
  userId,
  profiles,
  onNavigate,
}: UrgentActionBannerProps) {
  const [renderedAt] = useState(() => Date.now());
  const urgentRequests = useMemo(() => {
    return matchRequests
      .filter((r) => {
        if (r.toUserId !== userId) return false;
        if (r.status !== 'PENDING') return false;
        if (isRequestExpired(r)) return false;
        const remaining = new Date(r.expiresAt).getTime() - renderedAt;
        return remaining > 0 && remaining <= URGENT_THRESHOLD_MS;
      })
      .map((r) => {
        const sender = profiles.find((p) => p.id === r.fromUserId);
        const hoursLeft = Math.max(
          1,
          Math.ceil((new Date(r.expiresAt).getTime() - renderedAt) / (60 * 60 * 1000)),
        );
        return {
          id: r.id,
          nickname: sender?.nickname ?? '알 수 없음',
          hoursLeft,
        };
      });
  }, [matchRequests, profiles, renderedAt, userId]);

  if (urgentRequests.length === 0) return null;

  return (
    <div className="space-y-2">
      {urgentRequests.map((req, index) => (
        <motion.button
          key={req.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onNavigate('matching')}
          className="w-full bg-linear-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white text-left hover:from-amber-600 hover:to-orange-600 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0"
            >
              <Clock className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{req.nickname}님의 요청이 곧 만료돼요</p>
              <p className="text-xs opacity-90 mt-0.5">{req.hoursLeft}시간 후 만료</p>
            </div>
            <ChevronRight className="w-5 h-5 opacity-80 shrink-0" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}
