import type { MatchingActiveUnmatchView } from '../model/matching-active-view';

export function UnmatchProgress({ progress }: { readonly progress: MatchingActiveUnmatchView }) {
  return (
    <div className="min-w-0 rounded-2xl bg-(--knu-background-alt) p-4" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-(--knu-text-primary)">매칭 해제 동의</p>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-(--knu-primary)">
          {progress.progressText}
        </span>
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-(--knu-text-secondary)">
        {progress.statusCopy}
      </p>
      {progress.availableUntil ? (
        <p className="mt-2 text-xs leading-5 text-(--knu-text-tertiary)">
          매칭 해제 동의 가능 기한{' '}
          <time dateTime={progress.availableUntil}>
            {formatAvailableUntil(progress.availableUntil)}
          </time>
        </p>
      ) : null}
      {progress.disabledReasonCopy && progress.disabledReasonDescriptionId ? (
        <p
          id={progress.disabledReasonDescriptionId}
          className="mt-2 break-words text-sm leading-6 text-(--knu-text-tertiary)"
        >
          {progress.disabledReasonCopy}
        </p>
      ) : null}
    </div>
  );
}

function formatAvailableUntil(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}
