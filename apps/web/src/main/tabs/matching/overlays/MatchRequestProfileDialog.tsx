'use client';

import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import type { RoommateProfileDetailState } from '../../roommate-list/hooks/useRoommateProfileDetail';

export function MatchRequestProfileDialog({
  state,
  onClose,
  onRetry,
}: {
  readonly state: RoommateProfileDetailState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <BaseBottomSheet isOpen={state.status !== 'closed'} onClose={onClose} title="요청 상대 프로필">
      <div className="space-y-4 px-5 py-6">
        {state.status === 'loading' ? (
          <p role="status" className="text-sm text-(--knu-text-secondary)">
            {state.target.nickname}님의 최신 공개 프로필을 확인하고 있어요.
          </p>
        ) : null}
        {state.status === 'error' ? (
          <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
            <p>프로필을 확인하지 못했어요. 공개 상태가 변경되었을 수 있어요.</p>
            {state.error.retryable ? (
              <button
                type="button"
                className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold"
                onClick={onRetry}
              >
                다시 시도
              </button>
            ) : null}
          </div>
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'FULL' ? (
          <>
            <div>
              <h3 className="break-words text-xl font-bold text-(--knu-text-primary)">
                {state.profile.nickname}
              </h3>
              <p className="mt-2 break-words text-sm leading-6 text-(--knu-text-secondary)">
                {state.profile.intro || '작성된 자기소개가 없어요.'}
              </p>
            </div>
            {state.profile.exposure.scoreVisible && state.profile.matchScore !== undefined ? (
              <p className="rounded-2xl bg-(--knu-primary)/10 p-4 text-sm font-semibold text-(--knu-primary)">
                현재 매칭도 {state.profile.matchScore}점
              </p>
            ) : null}
            <p className="text-xs leading-5 text-(--knu-text-tertiary)">
              이 화면은 roommate-search public detail 정책을 다시 확인한 결과만 표시해요.
            </p>
          </>
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'TOMBSTONE' ? (
          <div className="rounded-2xl bg-(--knu-background-alt) p-4">
            <p className="font-semibold text-(--knu-text-primary)">
              {state.profile.tombstone.displayName}
            </p>
            <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">
              {state.profile.tombstone.message}
            </p>
          </div>
        ) : null}
      </div>
    </BaseBottomSheet>
  );
}
