import type { MatchingActiveView } from '../model/matching-active-view';
import { UnmatchProgress } from './UnmatchProgress';

export function ActiveMatchSummaryCard({
  activeMatch,
  readOnly,
  pending = false,
  onOpenProfile,
  onNavigateChat,
  onUnmatchDecision,
}: {
  readonly activeMatch: MatchingActiveView;
  readonly readOnly: boolean;
  readonly pending?: boolean;
  readonly onOpenProfile?: (trigger: HTMLButtonElement) => void;
  readonly onNavigateChat?: () => void;
  readonly onUnmatchDecision?: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <article className="min-w-0 rounded-3xl border border-(--knu-border) bg-white p-5 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-(--knu-primary)">현재 룸메이트</p>
        <h3 className="mt-1 break-words text-xl font-bold text-(--knu-text-primary)">
          {activeMatch.nickname}
        </h3>
        <p className="mt-2 break-words text-sm leading-6 text-(--knu-text-secondary)">
          {activeMatch.intro ?? '공개된 자기소개가 없어요.'}
        </p>
        <p className="mt-2 text-xs text-(--knu-text-tertiary)">
          <time dateTime={activeMatch.startedAt}>{formatMatchedAt(activeMatch.startedAt)}</time>{' '}
          매칭 확정
        </p>
      </div>

      {activeMatch.scoreState === 'visible' && activeMatch.score !== null ? (
        <p className="mt-4 rounded-2xl bg-(--knu-primary)/10 p-4 text-sm font-semibold text-(--knu-primary)">
          현재 매칭도 {activeMatch.score}점
        </p>
      ) : activeMatch.scoreState === 'hidden' ? (
        <p className="mt-4 text-sm text-(--knu-text-tertiary)">
          현재 공개 정책에서는 매칭 점수가 표시되지 않아요.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {activeMatch.canOpenProfile && onOpenProfile ? (
          <button
            type="button"
            className="min-h-11 rounded-2xl border border-(--knu-border) px-4 text-sm font-semibold text-(--knu-text-primary)"
            onClick={(event) => onOpenProfile(event.currentTarget)}
          >
            {activeMatch.nickname} 프로필 상세 보기
          </button>
        ) : null}
        {activeMatch.canStartChat && onNavigateChat ? (
          <button
            type="button"
            className="min-h-11 rounded-2xl bg-(--knu-primary) px-4 text-sm font-semibold text-white"
            onClick={onNavigateChat}
          >
            채팅하기
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="mt-5 space-y-3 border-t border-(--knu-border) pt-5">
          <UnmatchProgress progress={activeMatch.unmatch} />
          {activeMatch.unmatch.primaryAction && onUnmatchDecision ? (
            <button
              type="button"
              className="min-h-11 w-full rounded-2xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"
              disabled={pending}
              aria-describedby={activeMatch.unmatch.disabledReasonDescriptionId ?? undefined}
              onClick={(event) => onUnmatchDecision(event.currentTarget)}
            >
              {pending ? '처리 중…' : activeMatch.unmatch.primaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function formatMatchedAt(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}
