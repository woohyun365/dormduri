import type { PublicProfile } from '@repo/shared/profile/contract';
import type { MatchingApiError } from '../api/matching.api';

export interface MatchHistoryDetailContentProps {
  readonly profile: PublicProfile | null;
  readonly loading: boolean;
  readonly error: MatchingApiError | null;
  readonly onRetry?: () => void;
}

export function MatchHistoryDetailContent({
  profile,
  loading,
  error,
  onRetry,
}: MatchHistoryDetailContentProps) {
  if (loading) {
    return (
      <p role="status" className="text-sm leading-6 text-(--knu-text-secondary)">
        당시 상대 프로필을 확인하고 있어요.
      </p>
    );
  }

  if (error) {
    const retryable = error.code !== 'MATCHING_HISTORY_DETAIL_UNAVAILABLE';
    return (
      <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
        <p>
          {retryable
            ? '과거 상대 프로필을 확인하지 못했어요. 잠시 후 다시 시도해주세요.'
            : '이 기록의 상대 프로필은 더 이상 확인할 수 없어요.'}
        </p>
        {retryable && onRetry ? (
          <button
            type="button"
            className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold"
            onClick={onRetry}
          >
            다시 시도
          </button>
        ) : null}
      </div>
    );
  }

  if (!profile) return null;

  if (profile.detailState === 'TOMBSTONE') {
    return (
      <div className="rounded-2xl bg-(--knu-background-alt) p-4">
        <p className="font-semibold text-(--knu-text-primary)">{profile.tombstone.displayName}</p>
        <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">
          {profile.tombstone.message}
        </p>
      </div>
    );
  }

  const snapshotScore =
    profile.resultRead.context === 'PAST_MATCH_HISTORY' &&
    profile.exposure.scoreVisible &&
    typeof profile.matchScore === 'number'
      ? profile.matchScore
      : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="wrap-break-word text-xl font-bold text-(--knu-text-primary)">
          {profile.nickname}
        </h3>
        <p className="mt-2 wrap-break-word text-sm leading-6 text-(--knu-text-secondary)">
          {profile.intro || '작성된 자기소개가 없어요.'}
        </p>
      </div>
      {snapshotScore !== null ? (
        <p className="rounded-2xl bg-(--knu-primary)/10 p-4 text-sm font-semibold text-(--knu-primary)">
          당시 매칭도 {snapshotScore}점
        </p>
      ) : null}
      <p className="text-xs leading-5 text-(--knu-text-tertiary)">
        과거 이력에 보존된 결과만 표시해요. 현재 프로필로 다시 계산하지 않아요.
      </p>
    </div>
  );
}
