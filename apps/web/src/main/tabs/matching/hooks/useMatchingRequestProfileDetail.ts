'use client';

import { useRef, useState } from 'react';
import {
  useRoommateProfileDetail,
  type RoommateProfileDetailTarget,
} from '../../roommate-list/hooks/useRoommateProfileDetail';
import type { MatchingRequestCardView } from '../model/matching-request-view';

/** Request summary의 context proof를 roommate-search public detail owner에 전달하는 얇은 adapter다. */
export function useMatchingRequestProfileDetail() {
  const detail = useRoommateProfileDetail();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [request, setRequest] = useState<MatchingRequestCardView | null>(null);

  const open = (request: MatchingRequestCardView, trigger: HTMLButtonElement) => {
    if (!request.detailEntryToken) return;
    triggerRef.current = trigger;
    setRequest(request);
    detail.open({
      targetUserId: request.counterpartUserId,
      nickname: request.nickname,
      detailEntryToken: request.detailEntryToken,
      pendingMatchRequest: {
        id: request.id,
        direction: request.direction,
        label:
          request.direction === 'RECEIVED' ? '매칭 요청을 받은 사용자' : '이미 요청을 보낸 사용자',
      },
    } satisfies RoommateProfileDetailTarget);
  };

  const close = () => {
    detail.close();
    setRequest(null);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    queueMicrotask(() => trigger?.focus({ preventScroll: true }));
  };

  return { ...detail, request, open, close };
}
