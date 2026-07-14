'use client';

import { useRef } from 'react';
import {
  useRoommateProfileDetail,
  type RoommateProfileDetailTarget,
} from '../../roommate-list/hooks/useRoommateProfileDetail';
import type { MatchingRequestCardView } from '../model/matching-request-view';

/** Request summary의 context proof를 roommate-search public detail owner에 전달하는 얇은 adapter다. */
export function useMatchingRequestProfileDetail() {
  const detail = useRoommateProfileDetail();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const open = (request: MatchingRequestCardView, trigger: HTMLButtonElement) => {
    if (!request.detailEntryToken) return;
    triggerRef.current = trigger;
    detail.open({
      targetUserId: request.counterpartUserId,
      nickname: request.nickname,
      detailEntryToken: request.detailEntryToken,
      pendingMatchRequest: {
        id: request.id,
        direction: request.direction,
        label:
          request.direction === 'RECEIVED' ? '매칭 요청을 받은 사용자' : '매칭 요청을 보낸 사용자',
        description: '현재 매칭 요청의 public summary에서 연 프로필이에요.',
      },
    } satisfies RoommateProfileDetailTarget);
  };

  const close = () => {
    detail.close();
    const trigger = triggerRef.current;
    triggerRef.current = null;
    queueMicrotask(() => trigger?.focus());
  };

  return { ...detail, open, close };
}
